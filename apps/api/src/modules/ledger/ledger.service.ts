import { createHash } from "node:crypto";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { ledgerEntries, parties } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

export type { DbOrTx };
export type LedgerDirection = "debit" | "credit";

// First link in every tenant's chain — never a real hash, so it can't collide with one.
const GENESIS_HASH = "0".repeat(64);

function computeEntryHash(fields: {
  prevHash: string;
  tenantId: string;
  partyId: string;
  direction: string;
  amount: string;
  sourceType: string;
  sourceId: string;
  createdAt: Date;
}): string {
  const payload = [
    fields.prevHash,
    fields.tenantId,
    fields.partyId,
    fields.direction,
    fields.amount,
    fields.sourceType,
    fields.sourceId,
    fields.createdAt.toISOString(),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

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

  // Chain this entry to whatever was last written for this tenant — see verifyLedgerIntegrity,
  // which recomputes the whole chain and flags any row that no longer matches its hash.
  // Ordered by chainSeq (DB-assigned, strictly increasing per insert), not createdAt — two
  // entries in the same transaction (an invoice debit + its payment credit) can share the
  // same millisecond, and createdAt ties don't re-sort in a stable, predictable order.
  const [prevEntry] = await executor
    .select({ entryHash: ledgerEntries.entryHash })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.tenantId, params.tenantId))
    .orderBy(desc(ledgerEntries.chainSeq))
    .limit(1);
  const prevHash = prevEntry?.entryHash ?? GENESIS_HASH;

  // Must match Postgres's own numeric(14,2) canonical string exactly (e.g. "1.00", not "1")
  // — verifyLedgerIntegrity re-reads this same column later and re-hashes from what's
  // stored, so the pre-insert string has to already be in that stored form.
  const amount = params.amount.toFixed(2);
  const createdAt = new Date();
  const entryHash = computeEntryHash({
    prevHash,
    tenantId: params.tenantId,
    partyId: params.partyId,
    direction: params.direction,
    amount,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    createdAt,
  });

  const [entry] = await executor
    .insert(ledgerEntries)
    .values({
      tenantId: params.tenantId,
      partyId: params.partyId,
      direction: params.direction,
      amount,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt,
      prevHash,
      entryHash,
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

export type LedgerIntegrityResult = {
  valid: boolean;
  brokenAt: string | null;
  checkedCount: number;
  legacyUncheckedCount: number;
  totalEntries: number;
};

/**
 * Re-derives every entry's hash from its predecessor and compares it to what's stored.
 * A mismatch means that row (or one before it) was changed outside postLedgerEntry — the
 * only path that ever computes a hash. Rows written before hash-chaining existed have a
 * null entryHash and are skipped rather than treated as broken (see backfill-ledger-hashes.ts,
 * which fills them in once for a tenant's pre-existing history).
 *
 * Ordered by chainSeq, the same DB-assigned monotonic column postLedgerEntry chains against —
 * NOT createdAt, which two entries in one transaction can share to the millisecond.
 */
export async function verifyLedgerIntegrity(tenantId: string): Promise<LedgerIntegrityResult> {
  const entries = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.tenantId, tenantId))
    .orderBy(asc(ledgerEntries.chainSeq));

  let prevHash = GENESIS_HASH;
  let brokenAt: string | null = null;
  let checkedCount = 0;
  let legacyUncheckedCount = 0;

  for (const e of entries) {
    if (e.entryHash == null) {
      legacyUncheckedCount++;
      continue;
    }
    const expected = computeEntryHash({
      prevHash,
      tenantId: e.tenantId,
      partyId: e.partyId,
      direction: e.direction,
      amount: e.amount,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      createdAt: e.createdAt!,
    });
    checkedCount++;
    if (e.prevHash !== prevHash || e.entryHash !== expected) {
      brokenAt = e.id;
      break;
    }
    prevHash = e.entryHash;
  }

  return { valid: brokenAt === null, brokenAt, checkedCount, legacyUncheckedCount, totalEntries: entries.length };
}

export function listLedgerForParty(tenantId: string, partyId: string) {
  return db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.partyId, partyId)))
    .orderBy(desc(ledgerEntries.createdAt));
}

export type ListAllLedgerParams = {
  partyType?: "customer" | "supplier";
  search?: string;
  page?: number;
  limit?: number;
};

/** Tenant-wide ledger feed — every posting across every customer/supplier, newest first,
 * for the standalone Ledger page (as opposed to one party's own history). */
export async function listAllLedgerEntries(tenantId: string, params: ListAllLedgerParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 30));
  const offset = (page - 1) * limit;

  const conditions = [eq(ledgerEntries.tenantId, tenantId)];
  if (params.partyType) conditions.push(eq(parties.type, params.partyType));
  if (params.search) conditions.push(ilike(parties.name, `%${params.search}%`));
  const where = and(...conditions);

  const rows = await db
    .select({
      id: ledgerEntries.id,
      partyId: ledgerEntries.partyId,
      partyName: parties.name,
      partyType: parties.type,
      direction: ledgerEntries.direction,
      amount: ledgerEntries.amount,
      sourceType: ledgerEntries.sourceType,
      sourceId: ledgerEntries.sourceId,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(parties, eq(parties.id, ledgerEntries.partyId))
    .where(where)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ledgerEntries)
    .innerJoin(parties, eq(parties.id, ledgerEntries.partyId))
    .where(where);

  return { data: rows, page, limit, total: count };
}
