import { apiClient } from "../apiClient";

export type CashBookEntry = {
  id: number;
  tenantId: string;
  branchId: string;
  direction: "debit" | "credit";
  amount: string;
  description: string | null;
  createdAt: string;
};

export type CashBookListResponse = {
  data: CashBookEntry[];
  page: number;
  limit: number;
  total: number;
};

export async function listCashBookEntries(params: { branchId?: string; page?: number } = {}) {
  const res = await apiClient.get<CashBookListResponse>("/cash-book", { params });
  return res.data;
}

export async function getCashBookBalance(branchId: string) {
  const res = await apiClient.get<{ branchId: string; balance: number }>("/cash-book/balance", { params: { branchId } });
  return res.data;
}

export async function createCashBookEntry(input: { branchId: string; direction: "debit" | "credit"; amount: number; description?: string | null }) {
  const res = await apiClient.post<CashBookEntry>("/cash-book", input);
  return res.data;
}
