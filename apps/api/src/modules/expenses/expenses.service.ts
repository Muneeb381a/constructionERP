import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { branches, cashBook, expenses } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { karachiDateString } from "../../lib/timezone.js";
import type { CreateExpenseInput, ListExpensesQuery } from "./expenses.schema.js";

export type CreateExpenseContext = {
  tenantId: string;
  userId: string;
};

/** Records a categorized expense and auto-posts a matching Cash Out row to cash_book,
 * so the existing cash-in-hand total stays correct without the owner double-entering it. */
export async function createExpense(ctx: CreateExpenseContext, input: CreateExpenseInput) {
  const { tenantId, userId } = ctx;

  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.tenantId, tenantId), eq(expenses.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) return existing;

  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!branch) throw new HttpError(400, "branchId does not refer to a branch in this tenant");

  return db.transaction(async (tx) => {
    const [cashBookEntry] = await tx
      .insert(cashBook)
      .values({
        tenantId,
        branchId: input.branchId,
        direction: "credit", // cash out
        amount: input.amount.toString(),
        description: `Expense: ${input.category}${input.description ? ` — ${input.description}` : ""}`,
      })
      .returning();

    const [expense] = await tx
      .insert(expenses)
      .values({
        tenantId,
        branchId: input.branchId,
        category: input.category,
        amount: input.amount.toString(),
        description: input.description ?? null,
        method: input.method,
        expenseDate: input.expenseDate ?? karachiDateString(),
        cashBookEntryId: cashBookEntry.id,
        createdBy: userId,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    return expense;
  });
}

export async function listExpenses(tenantId: string, query: ListExpensesQuery) {
  const conditions = [eq(expenses.tenantId, tenantId)];
  if (query.branchId) conditions.push(eq(expenses.branchId, query.branchId));
  if (query.category) conditions.push(eq(expenses.category, query.category));
  if (query.dateFrom) conditions.push(gte(expenses.expenseDate, query.dateFrom));
  if (query.dateTo) conditions.push(lte(expenses.expenseDate, query.dateTo));

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }], [{ total }]] = await Promise.all([
    db.select().from(expenses).where(where).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)).limit(query.limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(expenses).where(where),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count, totalAmount: total };
}

export async function getCategorySummary(tenantId: string, query: { dateFrom?: string; dateTo?: string }) {
  const conditions = [eq(expenses.tenantId, tenantId)];
  if (query.dateFrom) conditions.push(gte(expenses.expenseDate, query.dateFrom));
  if (query.dateTo) conditions.push(lte(expenses.expenseDate, query.dateTo));

  return db
    .select({ category: expenses.category, total: sql<string>`sum(${expenses.amount})` })
    .from(expenses)
    .where(and(...conditions))
    .groupBy(expenses.category)
    .orderBy(desc(sql`sum(${expenses.amount})`));
}
