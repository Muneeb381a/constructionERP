import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { ledgerEntries, parties } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

export type { DbOrTx };
export type LedgerDirection = "debit" | "credit";

export type PostLedgerEntryParams = {
  tenantId: string;
  partyId: string;
  direction: LedgerDirection;
  amount: number;
  sourceType: string; // invoice, payment, opening_balance, adjustment, cheque_bounce, ...
  sourceId: string;
};

/**
 * The only place ledger_entries should ever be inserted from. Never write balance
 * changes ad hoc — always go through this, so every module's postings are auditable
 * and cachedBalance is always regenerated from history, never incremented directly.
 */
export async function postLedgerEntry(executor: DbOrTx, params: PostLedgerEntryParams) {
  if (params.amount <= 0) throw new HttpError(400, "Ledger entry amount must be positive");

  const [party] = await executor
    .select({ id: parties.id })
    .from(parties)
    .where(and(eq(parties.id, params.partyId), eq(parties.tenantId, params.tenantId)))
    .limit(1);
  if (!party) throw new HttpError(400, "partyId does not refer to a party in this tenant");

  const [entry] = await executor
    .insert(ledgerEntries)
    .values({
      tenantId: params.tenantId,
      partyId: params.partyId,
      direction: params.direction,
      amount: params.amount.toString(),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    })
    .returning();

  await recalculateBalance(executor, params.tenantId, params.partyId);

  return entry;
}

/**
 * Re-sums ledger_entries for a party and overwrites parties.cachedBalance — the only
 * way that column is ever set. debit = party owes more, credit = party owes less.
 */
export async function recalculateBalance(executor: DbOrTx, tenantId: string, partyId: string) {
  const [row] = await executor
    .select({
      debit: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'debit' then ${ledgerEntries.amount} else 0 end), 0)`,
      credit: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amount} else 0 end), 0)`,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.partyId, partyId)));

  const balance = Number(row?.debit ?? 0) - Number(row?.credit ?? 0);

  await executor
    .update(parties)
    .set({ cachedBalance: balance.toString(), balanceUpdatedAt: new Date() })
    .where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)));

  return balance;
}

export function listLedgerForParty(tenantId: string, partyId: string) {
  return db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.partyId, partyId)))
    .orderBy(desc(ledgerEntries.createdAt));
}
