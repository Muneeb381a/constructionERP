import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  invoiceItems,
  invoices,
  parties,
  payments,
  productStock,
  productUnitConversions,
  products,
  stockMovements,
  units,
} from "../../db/schema.js";

const dayExpr = sql<string>`to_char(${invoices.createdAt} at time zone 'Asia/Karachi', 'YYYY-MM-DD')`;

export type SalesTrendPoint = {
  day: string;
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  purchasesCount: number;
};

/** Daily sales vs. purchases totals, grouped by Asia/Karachi calendar day (never UTC —
 * same principle as the dashboard's "today" filter). */
export async function getSalesTrend(tenantId: string, dateFrom: Date, dateTo: Date): Promise<SalesTrendPoint[]> {
  const rows = await db
    .select({
      day: dayExpr,
      type: invoices.type,
      total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        ne(invoices.status, "void"),
        inArray(invoices.type, ["sale", "purchase"]),
        gte(invoices.createdAt, dateFrom),
        lte(invoices.createdAt, dateTo),
      ),
    )
    .groupBy(dayExpr, invoices.type)
    .orderBy(dayExpr);

  const byDay = new Map<string, SalesTrendPoint>();
  for (const row of rows) {
    const entry = byDay.get(row.day) ?? { day: row.day, salesTotal: 0, salesCount: 0, purchasesTotal: 0, purchasesCount: 0 };
    if (row.type === "sale") {
      entry.salesTotal = Number(row.total);
      entry.salesCount = row.count;
    } else {
      entry.purchasesTotal = Number(row.total);
      entry.purchasesCount = row.count;
    }
    byDay.set(row.day, entry);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Ranked by revenue (sum of line totals) — not by raw quantity, since a product can be
 * sold in more than one unit (Ton vs KG) and summing mixed units would be meaningless. */
export async function getTopProducts(tenantId: string, dateFrom: Date, dateTo: Date, limit: number) {
  return db
    .select({
      productId: products.id,
      name: products.name,
      revenue: sql<string>`coalesce(sum(${invoiceItems.lineTotal}), 0)`,
      orderCount: sql<number>`count(distinct ${invoiceItems.invoiceId})::int`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .innerJoin(products, eq(products.id, invoiceItems.productId))
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.type, "sale"),
        ne(invoices.status, "void"),
        gte(invoices.createdAt, dateFrom),
        lte(invoices.createdAt, dateTo),
      ),
    )
    .groupBy(products.id, products.name)
    .orderBy(sql`coalesce(sum(${invoiceItems.lineTotal}), 0) desc`)
    .limit(limit);
}

/**
 * Profit is an ESTIMATE: invoice_items snapshots the sale price at the time of sale
 * (correctly, per the "never re-derive from products.*" rule), but there is no
 * historical cost snapshot per line — only the product's CURRENT purchasePrice exists.
 * This uses today's cost as a stand-in for what the item actually cost when it sold,
 * which drifts for older periods if purchase prices have since changed. Good enough for
 * a rough margin read, not for financial reporting.
 */
export async function getProfitSummary(tenantId: string, dateFrom: Date, dateTo: Date) {
  const [row] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${invoiceItems.lineTotal}), 0)`,
      estimatedCost: sql<string>`coalesce(sum(${invoiceItems.quantity} * coalesce(${productUnitConversions.toBaseUnitFactor}, 1) * ${products.purchasePrice}), 0)`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .innerJoin(products, eq(products.id, invoiceItems.productId))
    .leftJoin(
      productUnitConversions,
      and(
        eq(productUnitConversions.productId, invoiceItems.productId),
        eq(productUnitConversions.fromUnitId, invoiceItems.unitId),
      ),
    )
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.type, "sale"),
        ne(invoices.status, "void"),
        gte(invoices.createdAt, dateFrom),
        lte(invoices.createdAt, dateTo),
      ),
    );

  const revenue = Number(row?.revenue ?? 0);
  const estimatedCost = Number(row?.estimatedCost ?? 0);
  return { revenue, estimatedCost, estimatedProfit: revenue - estimatedCost };
}

export type AgingRow = {
  partyId: string;
  partyName: string;
  phone: string | null;
  lastReminderSentAt: Date | null;
  current: number;
  d31to60: number;
  d61to90: number;
  d90plus: number;
  total: number;
};

/**
 * Buckets each party's still-unpaid bills by age (0-30 / 31-60 / 61-90 / 90+ days), the
 * same balance-per-bill math as payments.service.ts's listBillsForParty but computed
 * tenant-wide in one pass instead of per-party, so a shop can see who to chase first.
 */
export async function getAgingReport(tenantId: string, partyType: "customer" | "supplier"): Promise<AgingRow[]> {
  const billType = partyType === "supplier" ? "purchase" : "sale";

  const billInvoices = await db
    .select({
      id: invoices.id,
      partyId: invoices.partyId,
      totalAmount: invoices.totalAmount,
      createdAt: invoices.createdAt,
      partyName: parties.name,
      phone: parties.phone,
      lastReminderSentAt: parties.lastReminderSentAt,
    })
    .from(invoices)
    .innerJoin(parties, eq(parties.id, invoices.partyId))
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.type, billType), ne(invoices.status, "void"), eq(parties.type, partyType)));

  if (billInvoices.length === 0) return [];
  const billIds = billInvoices.map((b) => b.id);

  const returnRows = await db
    .select({ originalInvoiceId: invoices.originalInvoiceId, totalAmount: invoices.totalAmount })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.originalInvoiceId, billIds), ne(invoices.status, "void")));

  const paymentRows = await db
    .select({ invoiceId: payments.invoiceId, amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), inArray(payments.invoiceId, billIds)));

  const returnsByInvoice = new Map<string, number>();
  for (const r of returnRows) {
    if (!r.originalInvoiceId) continue;
    returnsByInvoice.set(r.originalInvoiceId, (returnsByInvoice.get(r.originalInvoiceId) ?? 0) + Number(r.totalAmount));
  }

  const paidByInvoice = new Map<string, number>();
  for (const p of paymentRows) {
    if (!p.invoiceId) continue;
    paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + Number(p.amount));
  }

  const byParty = new Map<string, AgingRow>();
  const now = Date.now();

  for (const inv of billInvoices) {
    if (!inv.partyId) continue;
    const returnsTotal = returnsByInvoice.get(inv.id) ?? 0;
    const paidTotal = paidByInvoice.get(inv.id) ?? 0;
    const balanceDue = Number(inv.totalAmount) - returnsTotal - paidTotal;
    if (balanceDue <= 0.01) continue;

    const ageDays = Math.floor((now - new Date(inv.createdAt!).getTime()) / 86_400_000);
    const row = byParty.get(inv.partyId) ?? {
      partyId: inv.partyId,
      partyName: inv.partyName,
      phone: inv.phone,
      lastReminderSentAt: inv.lastReminderSentAt,
      current: 0,
      d31to60: 0,
      d61to90: 0,
      d90plus: 0,
      total: 0,
    };

    if (ageDays <= 30) row.current += balanceDue;
    else if (ageDays <= 60) row.d31to60 += balanceDue;
    else if (ageDays <= 90) row.d61to90 += balanceDue;
    else row.d90plus += balanceDue;
    row.total += balanceDue;

    byParty.set(inv.partyId, row);
  }

  return [...byParty.values()].sort((a, b) => b.total - a.total);
}

export type ReorderSuggestion = {
  productId: string;
  name: string;
  unitId: number;
  unitName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  suggestedReorderQty: number;
};

/**
 * For every product currently below its reorder point, suggests a quantity that refills
 * it to capacity (maxStock, or 3x minStock if capacity was never set) and shows the
 * trailing-30-day sales pace so the owner can judge urgency, not just the raw shortfall.
 */
export async function getReorderSuggestions(tenantId: string): Promise<ReorderSuggestion[]> {
  const stockRows = await db
    .select({
      productId: products.id,
      name: products.name,
      minStock: products.minStock,
      maxStock: products.maxStock,
      currentStock: sql<string>`coalesce(sum(${productStock.quantity}), 0)`,
      unitId: products.baseUnitId,
      unitName: units.name,
    })
    .from(products)
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .innerJoin(units, eq(units.id, products.baseUnitId))
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
    .groupBy(products.id, products.name, products.minStock, products.maxStock, products.baseUnitId, units.name)
    .having(sql`coalesce(sum(${productStock.quantity}), 0) < ${products.minStock}`);

  if (stockRows.length === 0) return [];
  const productIds = stockRows.map((r) => r.productId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const salesRows = await db
    .select({ productId: stockMovements.productId, totalSold: sql<string>`sum(abs(${stockMovements.quantityChange}))` })
    .from(stockMovements)
    .where(and(inArray(stockMovements.productId, productIds), eq(stockMovements.reason, "sale"), gte(stockMovements.createdAt, thirtyDaysAgo)))
    .groupBy(stockMovements.productId);

  const salesByProduct = new Map(salesRows.map((r) => [r.productId, Number(r.totalSold)]));

  return stockRows
    .map((r) => {
      const currentStock = Number(r.currentStock);
      const minStock = Number(r.minStock ?? 0);
      const maxStock = r.maxStock != null ? Number(r.maxStock) : minStock * 3;
      const avgDailySales = (salesByProduct.get(r.productId) ?? 0) / 30;
      const daysOfStockLeft = avgDailySales > 0 ? currentStock / avgDailySales : null;
      const suggestedReorderQty = Math.max(maxStock - currentStock, 0);
      return {
        productId: r.productId,
        name: r.name,
        unitId: r.unitId,
        unitName: r.unitName,
        currentStock,
        minStock,
        maxStock,
        avgDailySales,
        daysOfStockLeft,
        suggestedReorderQty,
      };
    })
    .sort((a, b) => (a.daysOfStockLeft ?? Infinity) - (b.daysOfStockLeft ?? Infinity));
}
