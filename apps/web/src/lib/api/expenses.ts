import { apiClient } from "../apiClient";

export type Expense = {
  id: string;
  tenantId: string;
  branchId: string;
  category: string;
  amount: string;
  description: string | null;
  method: "cash" | "bank_transfer" | "cheque";
  expenseDate: string;
  cashBookEntryId: number | null;
  createdBy: string | null;
  createdAt: string;
};

export type ExpenseListResponse = {
  data: Expense[];
  page: number;
  limit: number;
  total: number;
  totalAmount: string;
};

export type ExpenseInput = {
  branchId: string;
  category: string;
  amount: number;
  description?: string | null;
  method: "cash" | "bank_transfer" | "cheque";
  expenseDate?: string;
};

export async function listExpenses(
  params: { branchId?: string; category?: string; dateFrom?: string; dateTo?: string; page?: number } = {},
) {
  const res = await apiClient.get<ExpenseListResponse>("/expenses", { params });
  return res.data;
}

export async function createExpense(input: ExpenseInput) {
  const res = await apiClient.post<Expense>("/expenses", input);
  return res.data;
}

export type CategorySummaryRow = { category: string; total: string };

export async function getExpenseCategorySummary(params: { dateFrom?: string; dateTo?: string } = {}) {
  const res = await apiClient.get<CategorySummaryRow[]>("/expenses/category-summary", { params });
  return res.data;
}
