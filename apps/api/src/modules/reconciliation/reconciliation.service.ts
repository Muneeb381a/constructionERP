import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { auditLog, parties } from "../../db/schema.js";
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
export async function reconcileAllBalances(tenantId?: string): Promise<BalanceMismatch[]> {
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

  return mismatches;
}
