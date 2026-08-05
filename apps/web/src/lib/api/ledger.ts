import { apiClient } from "../apiClient";

export type LedgerEntry = {
  id: string;
  tenantId: string;
  partyId: string;
  direction: "debit" | "credit";
  amount: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export type PartyLedgerResponse = {
  cachedBalance: string;
  balanceUpdatedAt: string | null;
  entries: LedgerEntry[];
};

export async function getPartyLedger(partyId: string) {
  const res = await apiClient.get<PartyLedgerResponse>(`/parties/${partyId}/ledger`);
  return res.data;
}

export async function postOpeningBalance(
  partyId: string,
  input: { idempotencyKey: string; direction: "debit" | "credit"; amount: number },
) {
  const res = await apiClient.post<LedgerEntry>(`/parties/${partyId}/ledger/opening-balance`, input);
  return res.data;
}

export async function postLedgerAdjustment(
  partyId: string,
  input: { idempotencyKey: string; direction: "debit" | "credit"; amount: number },
) {
  const res = await apiClient.post<LedgerEntry>(`/parties/${partyId}/ledger/adjustment`, input);
  return res.data;
}

export type AllLedgerEntry = {
  id: string;
  partyId: string;
  partyName: string;
  partyType: "customer" | "supplier";
  direction: "debit" | "credit";
  amount: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export type AllLedgerResponse = {
  data: AllLedgerEntry[];
  page: number;
  limit: number;
  total: number;
};

export async function listAllLedger(params: { partyType?: "customer" | "supplier"; search?: string; page?: number }) {
  const res = await apiClient.get<AllLedgerResponse>("/ledger", { params });
  return res.data;
}

export type LedgerIntegrityResult = {
  valid: boolean;
  brokenAt: string | null;
  checkedCount: number;
  legacyUncheckedCount: number;
  totalEntries: number;
};

export async function verifyLedgerIntegrity() {
  const res = await apiClient.get<LedgerIntegrityResult>("/ledger/verify-integrity");
  return res.data;
}
