import { and, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { dailyClosings, expenses, invoices, payments } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { getCashInHand } from "../dashboard/dashboard.service.js";
import { karachiDateString, karachiDayRangeUtc } from "../../lib/timezone.js";
import type { CreateClosingInput } from "./closing.schema.js";

/**
 * "Cash in hand" (the running Cash Book balance) only reflects manual entries and
 * auto-posted cash expenses — sales revenue and payment collections never touch the Cash
 * Book. So today's expected cash is the current Cash Book balance *plus* what came in
 * today via sales/payments that the Cash Book doesn't know about yet. Walk-in sales (no
 * party) have no payment-method field at all, so they're assumed cash — the shop's own
 * counted-cash entry is what actually catches any that weren't.
 */
export async function getTodayClosingPreview(tenantId: string, branchId: string) {
  const { start, end } = karachiDayRangeUtc();
  const closingDate = karachiDateString();

  const salesPurchaseRows = await db
    .select({
      type: invoices.type,
      total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.branchId, branchId),
        gte(invoices.createdAt, start),
        lt(invoices.createdAt, end),
        ne(invoices.status, "void"),
      ),
    )
    .groupBy(invoices.type);

  const salesTotal = Number(salesPurchaseRows.find((r) => r.type === "sale")?.total ?? 0);
  const salesCount = salesPurchaseRows.find((r) => r.type === "sale")?.count ?? 0;
  const purchasesTotal = Number(salesPurchaseRows.find((r) => r.type === "purchase")?.total ?? 0);

  const [walkInRow] = await db
    .select({ total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.branchId, branchId),
        eq(invoices.type, "sale"),
        isNull(invoices.partyId),
        ne(invoices.status, "void"),
        gte(invoices.createdAt, start),
        lt(invoices.createdAt, end),
      ),
    );
  const walkInCashSales = Number(walkInRow?.total ?? 0);

  const paymentRows = await db
    .select({ method: payments.method, total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), gte(payments.createdAt, start), lt(payments.createdAt, end)))
    .groupBy(payments.method);

  const cashCollected = walkInCashSales + Number(paymentRows.find((r) => r.method === "cash")?.total ?? 0);
  const bankCollected = Number(paymentRows.find((r) => r.method === "bank_transfer")?.total ?? 0);
  const chequeCollected = Number(paymentRows.find((r) => r.method === "cheque")?.total ?? 0);

  const [expenseRow] = await db
    .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(eq(expenses.tenantId, tenantId), eq(expenses.branchId, branchId), eq(expenses.expenseDate, closingDate)));
  const expensesTotal = Number(expenseRow?.total ?? 0);

  // cash book balance already nets out manual entries + auto-posted cash expenses (today's
  // included) — cash sales/payments are the only thing it doesn't know about, so add those
  const cashInHand = await getCashInHand(tenantId, branchId);
  const expectedCash = cashInHand + walkInCashSales + Number(paymentRows.find((r) => r.method === "cash")?.total ?? 0);

  const [existing] = await db
    .select()
    .from(dailyClosings)
    .where(and(eq(dailyClosings.branchId, branchId), eq(dailyClosings.closingDate, closingDate)))
    .limit(1);

  return {
    closingDate,
    salesTotal,
    salesCount,
    purchasesTotal,
    cashCollected,
    bankCollected,
    chequeCollected,
    expensesTotal,
    expectedCash,
    alreadyClosed: !!existing,
    existingClosing: existing ?? null,
  };
}

export async function createClosing(tenantId: string, branchId: string, userId: string, input: CreateClosingInput) {
  const preview = await getTodayClosingPreview(tenantId, branchId);
  if (preview.alreadyClosed) throw new HttpError(409, "Today has already been closed");

  const discrepancy = input.countedCash - preview.expectedCash;

  try {
    const [closing] = await db
      .insert(dailyClosings)
      .values({
        tenantId,
        branchId,
        closingDate: preview.closingDate,
        salesTotal: preview.salesTotal.toString(),
        purchasesTotal: preview.purchasesTotal.toString(),
        cashCollected: preview.cashCollected.toString(),
        bankCollected: preview.bankCollected.toString(),
        chequeCollected: preview.chequeCollected.toString(),
        expensesTotal: preview.expensesTotal.toString(),
        expectedCash: preview.expectedCash.toString(),
        countedCash: input.countedCash.toString(),
        discrepancy: discrepancy.toString(),
        notes: input.notes ?? null,
        closedBy: userId,
      })
      .returning();
    return closing;
  } catch (err) {
    if ((err as { code?: string })?.code === "23505" || (err as { cause?: { code?: string } })?.cause?.code === "23505") {
      throw new HttpError(409, "Today has already been closed");
    }
    throw err;
  }
}

export async function listClosings(tenantId: string, branchId: string, limit = 30) {
  return db
    .select()
    .from(dailyClosings)
    .where(and(eq(dailyClosings.tenantId, tenantId), eq(dailyClosings.branchId, branchId)))
    .orderBy(desc(dailyClosings.closingDate))
    .limit(limit);
}
