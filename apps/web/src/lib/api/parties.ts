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

export async function listParties(params: { search?: string; type?: "customer" | "supplier"; page?: number } = {}) {
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
