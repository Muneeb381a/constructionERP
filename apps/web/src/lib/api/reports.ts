import { apiClient } from "../apiClient";

export type SalesTrendPoint = {
  day: string;
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  purchasesCount: number;
};

export type TopProduct = {
  productId: string;
  name: string;
  revenue: string;
  orderCount: number;
};

export type ProfitSummary = {
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
};

export async function getSalesTrend(dateFrom: string, dateTo: string) {
  const res = await apiClient.get<SalesTrendPoint[]>("/reports/sales-trend", { params: { dateFrom, dateTo } });
  return res.data;
}

export async function getTopProducts(dateFrom: string, dateTo: string, limit = 10) {
  const res = await apiClient.get<TopProduct[]>("/reports/top-products", { params: { dateFrom, dateTo, limit } });
  return res.data;
}

export async function getProfitSummary(dateFrom: string, dateTo: string) {
  const res = await apiClient.get<ProfitSummary>("/reports/profit-summary", { params: { dateFrom, dateTo } });
  return res.data;
}

export type AgingRow = {
  partyId: string;
  partyName: string;
  phone: string | null;
  lastReminderSentAt: string | null;
  current: number;
  d31to60: number;
  d61to90: number;
  d90plus: number;
  total: number;
};

export async function getAgingReport(partyType: "customer" | "supplier") {
  const res = await apiClient.get<AgingRow[]>("/reports/aging", { params: { partyType } });
  return res.data;
}

export type ReorderSuggestion = {
  productId: string;
  name: string;
  unitId: number;
  unitName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  suggestedReorderQty: number;
};

export async function getReorderSuggestions() {
  const res = await apiClient.get<ReorderSuggestion[]>("/reports/reorder-suggestions");
  return res.data;
}
