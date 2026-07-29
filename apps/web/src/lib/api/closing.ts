import { apiClient } from "../apiClient";

export type ClosingPreview = {
  closingDate: string;
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  cashCollected: number;
  bankCollected: number;
  chequeCollected: number;
  expensesTotal: number;
  expectedCash: number;
  alreadyClosed: boolean;
  existingClosing: DailyClosing | null;
};

export type DailyClosing = {
  id: string;
  tenantId: string;
  branchId: string;
  closingDate: string;
  salesTotal: string;
  purchasesTotal: string;
  cashCollected: string;
  bankCollected: string;
  chequeCollected: string;
  expensesTotal: string;
  expectedCash: string;
  countedCash: string;
  discrepancy: string;
  notes: string | null;
  closedBy: string | null;
  createdAt: string;
};

export async function getTodayClosingPreview() {
  const res = await apiClient.get<ClosingPreview>("/closing/today");
  return res.data;
}

export async function createClosing(input: { countedCash: number; notes?: string | null }) {
  const res = await apiClient.post<DailyClosing>("/closing", input);
  return res.data;
}

export async function listClosings() {
  const res = await apiClient.get<DailyClosing[]>("/closing");
  return res.data;
}
