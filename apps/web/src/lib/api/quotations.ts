import { apiClient } from "../apiClient";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export type Quotation = {
  id: string;
  tenantId: string;
  branchId: string;
  quotationNo: string;
  partyId: string | null;
  userId: string | null;
  status: QuotationStatus;
  subtotal: string;
  discount: string;
  totalAmount: string;
  validUntil: string | null;
  notes: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
};

export type QuotationItem = {
  id: number;
  quotationId: string;
  productId: string;
  unitId: number;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type CreateQuotationInput = {
  branchId: string;
  partyId?: string | null;
  discount?: number;
  validUntil?: string | null;
  notes?: string | null;
  items: {
    productId: string;
    unitId: number;
    quantity: number;
    unitPrice?: number;
  }[];
};

export type QuotationListResponse = {
  data: Quotation[];
  page: number;
  limit: number;
  total: number;
};

export async function createQuotation(input: CreateQuotationInput) {
  const res = await apiClient.post<{ quotation: Quotation; items: QuotationItem[] }>("/quotations", input);
  return res.data;
}

export async function listQuotations(params: { status?: QuotationStatus; partyId?: string; page?: number } = {}) {
  const res = await apiClient.get<QuotationListResponse>("/quotations", { params });
  return res.data;
}

export async function getQuotation(id: string) {
  const res = await apiClient.get<{ quotation: Quotation; items: QuotationItem[] }>(`/quotations/${id}`);
  return res.data;
}

export async function updateQuotationStatus(id: string, status: "sent" | "accepted" | "rejected" | "expired") {
  const res = await apiClient.patch<Quotation>(`/quotations/${id}/status`, { status });
  return res.data;
}

export async function convertQuotation(id: string, input: { warehouseId: string; overrideCreditLimit?: boolean }) {
  const res = await apiClient.post(`/quotations/${id}/convert`, input);
  return res.data as { invoice: { id: string; invoiceNo: string } };
}
