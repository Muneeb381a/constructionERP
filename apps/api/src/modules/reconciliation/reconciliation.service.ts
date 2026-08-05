import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { auditLog, parties, reconciliationRuns } from "../../db/schema.js";
import { recalculateBalance } from "../ledger/ledger.service.js";

const DRIFT_TOLERANCE = 0.005; // half a paisa — accounts for numeric rounding, not real drift

export type BalanceMismatch = {
  partyId: string;
  tenantId: string;
  partyName: string;
  before: number;
  after: number;
  drift: number;
};

/**
 * Re-sums ledger_entries for every party and overwrites cached_balance (the only way that
 * column is ever set — see ledger.service.ts). Any party whose stored balance didn't match
 * the re-summed total is drift that shouldn't be possible through the app's own code paths
 * (a bug, a manual DB edit, a botched migration) — those get logged to audit_log so an
 * owner can investigate, even though the value itself is already self-healed by this run.
 */
export async function reconcileAllBalances(tenantId?: string, triggeredBy: "cron" | "manual" = "manual"): Promise<BalanceMismatch[]> {
  const allParties = tenantId
    ? await db.select().from(parties).where(eq(parties.tenantId, tenantId))
    : await db.select().from(parties);
  const mismatches: BalanceMismatch[] = [];

  for (const party of allParties) {
    const before = Number(party.cachedBalance);
    const after = await recalculateBalance(db, party.tenantId, party.id);

    if (Math.abs(after - before) > DRIFT_TOLERANCE) {
      mismatches.push({ partyId: party.id, tenantId: party.tenantId, partyName: party.name, before, after, drift: after - before });
    }
  }

  if (mismatches.length > 0) {
    await db.insert(auditLog).values(
      mismatches.map((m) => ({
        tenantId: m.tenantId,
        userId: null,
        action: "balance_reconciliation_mismatch",
        entityType: "party",
        entityId: m.partyId,
        beforeData: JSON.stringify({ cachedBalance: m.before }),
        afterData: JSON.stringify({ cachedBalance: m.after, drift: m.drift }),
      })),
    );
  }

  // record this pass even when everything matched — otherwise a clean run leaves no trace
  // at all, and "last checked" can never be shown on a quiet day
  const tenantsTouched = tenantId ? [tenantId] : [...new Set(allParties.map((p) => p.tenantId))];
  if (tenantsTouched.length > 0) {
    const mismatchCountByTenant = new Map<string, number>();
    for (const m of mismatches) mismatchCountByTenant.set(m.tenantId, (mismatchCountByTenant.get(m.tenantId) ?? 0) + 1);
    await db.insert(reconciliationRuns).values(
      tenantsTouched.map((tid) => ({
        tenantId: tid,
        mismatchCount: mismatchCountByTenant.get(tid) ?? 0,
        triggeredBy,
      })),
    );
  }

  return mismatches;
}

export async function getLastReconciliationRun(tenantId: string) {
  const [run] = await db
    .select()
    .from(reconciliationRuns)
    .where(eq(reconciliationRuns.tenantId, tenantId))
    .orderBy(desc(reconciliationRuns.createdAt))
    .limit(1);
  return run ?? null;
}
