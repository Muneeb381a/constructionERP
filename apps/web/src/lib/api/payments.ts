import { apiClient } from "../apiClient";

export type Cheque = {
  id: string;
  paymentId: string;
  chequeNo: string;
  bankName: string | null;
  dueDate: string;
  status: "pending" | "cleared" | "bounced";
};

export type Payment = {
  id: string;
  tenantId: string;
  partyId: string;
  invoiceId: string | null;
  method: "cash" | "bank_transfer" | "cheque";
  amount: string;
  note: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type PaymentWithCheque = Payment & { cheque: Cheque | null; invoiceNo: string | null };

export type CreatePaymentInput = {
  idempotencyKey: string;
  partyId: string;
  invoiceId?: string | null;
  method: "cash" | "bank_transfer" | "cheque";
  amount: number;
  note?: string | null;
  cheque?: {
    chequeNo: string;
    bankName?: string | null;
    dueDate: string;
  };
};

export type PartyBill = {
  invoice: {
    id: string;
    invoiceNo: string;
    type: "sale" | "purchase" | "sale_return" | "purchase_return";
    status: "draft" | "confirmed" | "void";
    totalAmount: string;
    createdAt: string;
  };
  returnsTotal: number;
  netAmount: number;
  paidTotal: number;
  balanceDue: number;
  status: "paid" | "partial" | "unpaid" | "void";
};

export type CreatePaymentResult = {
  payment: Payment;
  cheque: Cheque | null;
  idempotentReplay: boolean;
};

export async function createPayment(input: CreatePaymentInput) {
  const res = await apiClient.post<CreatePaymentResult>("/payments", input);
  return res.data;
}

export async function listPartyPayments(partyId: string) {
  const res = await apiClient.get<PaymentWithCheque[]>(`/parties/${partyId}/payments`);
  return res.data;
}

export async function listPartyBills(partyId: string) {
  const res = await apiClient.get<PartyBill[]>(`/parties/${partyId}/payments/bills`);
  return res.data;
}

export async function updateChequeStatus(chequeId: string, status: "cleared" | "bounced") {
  const res = await apiClient.patch<Cheque>(`/payments/cheques/${chequeId}/status`, { status });
  return res.data;
}

export type ChequeRegisterEntry = {
  id: string;
  chequeNo: string;
  bankName: string | null;
  dueDate: string;
  status: "pending" | "cleared" | "bounced";
  amount: string;
  partyId: string;
  partyName: string;
  partyType: "customer" | "supplier";
  createdAt: string;
};

export async function listChequeRegister(params: { status?: "pending" | "cleared" | "bounced" } = {}) {
  const res = await apiClient.get<ChequeRegisterEntry[]>("/payments/cheques", { params });
  return res.data;
}
