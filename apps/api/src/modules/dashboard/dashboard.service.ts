import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { cashBook, invoices, parties, productStock, products } from "../../db/schema.js";
import { karachiDayRangeUtc } from "../../lib/timezone.js";

export async function getTodaySummary(tenantId: string, branchId?: string) {
  const { start, end } = karachiDayRangeUtc();

  const conditions = [
    eq(invoices.tenantId, tenantId),
    gte(invoices.createdAt, start),
    lt(invoices.createdAt, end),
    ne(invoices.status, "void"),
  ];
  if (branchId) conditions.push(eq(invoices.branchId, branchId));

  const rows = await db
    .select({
      type: invoices.type,
      total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(and(...conditions))
    .groupBy(invoices.type);

  const summary = {
    sales: { total: 0, count: 0 },
    purchases: { total: 0, count: 0 },
  };
  for (const row of rows) {
    if (row.type === "sale") summary.sales = { total: Number(row.total), count: row.count };
    if (row.type === "purchase") summary.purchases = { total: Number(row.total), count: row.count };
  }
  return summary;
}

export async function getCashInHand(tenantId: string, branchId?: string) {
  const conditions = [eq(cashBook.tenantId, tenantId)];
  if (branchId) conditions.push(eq(cashBook.branchId, branchId));

  const [row] = await db
    .select({
      debit: sql<string>`coalesce(sum(case when ${cashBook.direction} = 'debit' then ${cashBook.amount} else 0 end), 0)`,
      credit: sql<string>`coalesce(sum(case when ${cashBook.direction} = 'credit' then ${cashBook.amount} else 0 end), 0)`,
    })
    .from(cashBook)
    .where(and(...conditions));

  return Number(row?.debit ?? 0) - Number(row?.credit ?? 0);
}

export async function getOutstanding(tenantId: string) {
  const rows = await db
    .select({ type: parties.type, total: sql<string>`coalesce(sum(${parties.cachedBalance}), 0)` })
    .from(parties)
    .where(eq(parties.tenantId, tenantId))
    .groupBy(parties.type);

  const result = { receivables: 0, payables: 0 };
  for (const row of rows) {
    if (row.type === "customer") result.receivables = Number(row.total);
    if (row.type === "supplier") result.payables = Number(row.total);
  }
  return result;
}

export function getLowStock(tenantId: string) {
  return db
    .select({
      productId: products.id,
      name: products.name,
      minStock: products.minStock,
      currentStock: sql<string>`coalesce(sum(${productStock.quantity}), 0)`,
    })
    .from(products)
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
    .groupBy(products.id, products.minStock)
    .having(sql`coalesce(sum(${productStock.quantity}), 0) < ${products.minStock}`);
}
