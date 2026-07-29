import { apiClient } from "../apiClient";

export type Party = {
  id: string;
  tenantId: string;
  type: "customer" | "supplier";
  name: string;
  phone: string | null;
  cnic: string | null;
  address: string | null;
  creditLimit: string;
  cachedBalance: string;
  balanceUpdatedAt: string | null;
  lastReminderSentAt: string | null;
  createdAt: string;
};

export type PartyListResponse = {
  data: Party[];
  page: number;
  limit: number;
  total: number;
};

export type PartyInput = {
  type: "customer" | "supplier";
  name: string;
  phone?: string | null;
  cnic?: string | null;
  address?: string | null;
  creditLimit?: number;
};

export async function listParties(
  params: { search?: string; type?: "customer" | "supplier"; page?: number; sort?: "recent" | "balance" } = {},
) {
  const res = await apiClient.get<PartyListResponse>("/parties", { params });
  return res.data;
}

export async function getParty(id: string) {
  const res = await apiClient.get<Party>(`/parties/${id}`);
  return res.data;
}

export type TopCustomer = {
  id: string;
  name: string;
  phone: string | null;
  cachedBalance: string;
  orderCount: number;
  totalSpent: string;
  lastPurchaseAt: string;
};

export async function getTopCustomers(limit = 5) {
  const res = await apiClient.get<TopCustomer[]>("/parties/top-customers", { params: { limit } });
  return res.data;
}

export async function createParty(input: PartyInput) {
  const res = await apiClient.post<Party>("/parties", input);
  return res.data;
}

export async function updateParty(id: string, input: Partial<PartyInput>) {
  const res = await apiClient.patch<Party>(`/parties/${id}`, input);
  return res.data;
}

export async function deleteParty(id: string) {
  await apiClient.delete(`/parties/${id}`);
}

export async function getPartyPublicLink(id: string) {
  const res = await apiClient.post<{ token: string }>(`/parties/${id}/public-link`);
  return res.data;
}

export async function revokePartyPublicLink(id: string) {
  await apiClient.delete(`/parties/${id}/public-link`);
}

export async function markReminderSent(id: string) {
  const res = await apiClient.post<{ id: string; lastReminderSentAt: string }>(`/parties/${id}/reminder-sent`);
  return res.data;
}

export async function downloadPartyStatement(id: string) {
  const res = await apiClient.get(`/parties/${id}/statement.pdf`, { responseType: "blob" });
  return res.data as Blob;
}

export type PublicBalanceBill = {
  invoiceNo: string;
  date: string;
  totalAmount: string;
  balanceDue: number;
  status: "paid" | "partial" | "unpaid" | "void";
};

export type PublicBalance = {
  partyName: string;
  balance: string;
  balanceUpdatedAt: string | null;
  bills: PublicBalanceBill[];
};

export async function getPublicBalance(token: string) {
  const res = await apiClient.get<PublicBalance>(`/public/balance/${token}`);
  return res.data;
}
