import { apiClient } from "../apiClient";

export type BalanceMismatch = {
  partyId: string;
  tenantId: string;
  partyName: string;
  before: number;
  after: number;
  drift: number;
};

export type ReconciliationResult = { mismatchesFound: number; mismatches: BalanceMismatch[] };

export type ReconciliationRun = {
  id: string;
  tenantId: string;
  mismatchCount: number;
  triggeredBy: "cron" | "manual";
  createdAt: string;
};

export async function getLastReconciliationRun() {
  const res = await apiClient.get<ReconciliationRun | null>("/admin/reconcile/last-run");
  return res.data;
}

export async function runReconciliationNow() {
  const res = await apiClient.post<ReconciliationResult>("/admin/reconcile");
  return res.data;
}
