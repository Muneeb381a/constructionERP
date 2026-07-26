import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { branches, cashBook } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateCashBookEntryInput, ListCashBookQuery } from "./cashbook.schema.js";

export async function createEntry(tenantId: string, input: CreateCashBookEntryInput) {
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!branch) throw new HttpError(400, "branchId does not refer to a branch in this tenant");

  const [entry] = await db
    .insert(cashBook)
    .values({
      tenantId,
      branchId: input.branchId,
      direction: input.direction,
      amount: input.amount.toString(),
      description: input.description ?? null,
    })
    .returning();
  return entry;
}

export async function listEntries(tenantId: string, query: ListCashBookQuery) {
  const conditions = [eq(cashBook.tenantId, tenantId)];
  if (query.branchId) conditions.push(eq(cashBook.branchId, query.branchId));
  if (query.dateFrom) conditions.push(gte(cashBook.createdAt, query.dateFrom));
  if (query.dateTo) conditions.push(lte(cashBook.createdAt, query.dateTo));

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(cashBook).where(where).orderBy(desc(cashBook.createdAt)).limit(query.limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(cashBook).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}

/** Cash-in-hand for a branch — always computed live from the append-only log, never cached. */
export async function getBranchBalance(tenantId: string, branchId: string) {
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!branch) throw new HttpError(400, "branchId does not refer to a branch in this tenant");

  const [row] = await db
    .select({
      debit: sql<string>`coalesce(sum(case when ${cashBook.direction} = 'debit' then ${cashBook.amount} else 0 end), 0)`,
      credit: sql<string>`coalesce(sum(case when ${cashBook.direction} = 'credit' then ${cashBook.amount} else 0 end), 0)`,
    })
    .from(cashBook)
    .where(and(eq(cashBook.tenantId, tenantId), eq(cashBook.branchId, branchId)));

  const balance = Number(row?.debit ?? 0) - Number(row?.credit ?? 0);
  return { branchId, balance };
}
