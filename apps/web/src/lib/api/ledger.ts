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

export async function postOpeningBalance(partyId: string, input: { direction: "debit" | "credit"; amount: number }) {
  const res = await apiClient.post<LedgerEntry>(`/parties/${partyId}/ledger/opening-balance`, input);
  return res.data;
}

export async function postLedgerAdjustment(partyId: string, input: { direction: "debit" | "credit"; amount: number }) {
  const res = await apiClient.post<LedgerEntry>(`/parties/${partyId}/ledger/adjustment`, input);
  return res.data;
}
