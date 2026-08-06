import { apiClient } from "../apiClient";

export type InvoiceCharge = { label: string; amount: number };

export type InvoiceItem = {
  id: number;
  invoiceId: string;
  productId: string;
  unitId: number;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type Invoice = {
  id: string;
  tenantId: string;
  branchId: string;
  type: "sale" | "purchase" | "sale_return" | "purchase_return";
  status: "draft" | "confirmed" | "void";
  invoiceNo: string;
  partyId: string | null;
  partyName: string | null;
  projectId: string | null;
  userId: string | null;
  originalInvoiceId: string | null;
  subtotal: string;
  discount: string;
  otherCharges: InvoiceCharge[] | null;
  totalAmount: string;
  idempotencyKey: string;
  voidedAt: string | null;
  voidedBy: string | null;
  deliveryEmployeeId: string | null;
  deliveryStatus: "not_applicable" | "pending" | "delivered";
  deliveredAt: string | null;
  createdAt: string;
};

export type CreateSaleInvoiceInput = {
  idempotencyKey: string;
  branchId: string;
  warehouseId: string;
  partyId?: string | null;
  projectId?: string | null;
  discount?: number;
  otherCharges?: InvoiceCharge[];
  overrideCreditLimit?: boolean;
  payment?: {
    method: "cash" | "bank_transfer";
    amount: number;
    note?: string | null;
  };
  items: {
    productId: string;
    unitId: number;
    quantity: number;
    unitPrice?: number;
  }[];
};

export type Payment = {
  id: string;
  partyId: string;
  invoiceId: string | null;
  method: "cash" | "bank_transfer" | "cheque";
  amount: string;
  note: string | null;
  createdAt: string;
};

export type CreateSaleInvoiceResult = {
  invoice: Invoice;
  items: InvoiceItem[];
  payment: Payment | null;
  idempotentReplay: boolean;
};

export async function createSaleInvoice(input: CreateSaleInvoiceInput) {
  const res = await apiClient.post<CreateSaleInvoiceResult>("/invoices/sale", input);
  return res.data;
}

export type CreatePurchaseInvoiceInput = {
  idempotencyKey: string;
  branchId: string;
  warehouseId: string;
  partyId?: string | null;
  discount?: number;
  otherCharges?: InvoiceCharge[];
  items: {
    productId: string;
    unitId: number;
    quantity: number;
    unitPrice?: number;
  }[];
};

export async function createPurchaseInvoice(input: CreatePurchaseInvoiceInput) {
  const res = await apiClient.post<CreateSaleInvoiceResult>("/invoices/purchase", input);
  return res.data;
}

export type InvoiceListResponse = {
  data: Invoice[];
  page: number;
  limit: number;
  total: number;
};

export async function listInvoices(
  params: { type?: Invoice["type"]; partyId?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string } = {},
) {
  const res = await apiClient.get<InvoiceListResponse>("/invoices", { params });
  return res.data;
}

export async function getInvoice(id: string) {
  const res = await apiClient.get<{ invoice: Invoice; items: InvoiceItem[] }>(`/invoices/${id}`);
  return res.data;
}

export async function voidInvoice(id: string, reason: string) {
  const res = await apiClient.post<Invoice>(`/invoices/${id}/void`, { reason });
  return res.data;
}

export async function fetchInvoicePdf(id: string) {
  const res = await apiClient.get(`/invoices/${id}/pdf`, { responseType: "blob" });
  return res.data as Blob;
}

export async function fetchDeliveryChallanPdf(id: string) {
  const res = await apiClient.get(`/invoices/${id}/challan.pdf`, { responseType: "blob" });
  return res.data as Blob;
}

export async function getInvoicePublicLink(id: string) {
  const res = await apiClient.post<{ token: string }>(`/invoices/${id}/public-link`);
  return res.data;
}

export type PublicTrackingItem = { productName: string; unitName: string; quantity: string };

export type PublicTracking = {
  invoiceNo: string;
  status: "draft" | "confirmed" | "void";
  deliveryStatus: "not_applicable" | "pending" | "delivered";
  createdAt: string;
  deliveredAt: string | null;
  totalAmount: string;
  driverName: string | null;
  driverPhone: string | null;
  items: PublicTrackingItem[];
};

export async function getPublicTracking(token: string) {
  const res = await apiClient.get<PublicTracking>(`/public/tracking/${token}`);
  return res.data;
}

export type CreateReturnInvoiceInput = {
  idempotencyKey: string;
  originalInvoiceId: string;
  branchId: string;
  warehouseId: string;
  items: {
    productId: string;
    unitId: number;
    quantity: number;
  }[];
};

export async function createReturnInvoice(input: CreateReturnInvoiceInput) {
  const res = await apiClient.post<CreateSaleInvoiceResult>("/invoices/return", input);
  return res.data;
}

export async function assignDelivery(id: string, employeeId: string) {
  const res = await apiClient.post<Invoice>(`/invoices/${id}/delivery`, { employeeId });
  return res.data;
}

export async function markDelivered(id: string) {
  const res = await apiClient.post<Invoice>(`/invoices/${id}/delivery/complete`, {});
  return res.data;
}
