import { apiClient } from "../apiClient";

export type RateLock = {
  id: string;
  productId: string;
  productName: string;
  lockedPrice: string;
  validFrom: string;
  validUntil: string;
  notes: string | null;
  createdAt: string;
};

export type ActiveRateLock = {
  id: string;
  productId: string;
  productName: string;
  lockedPrice: string;
  validUntil: string;
};

export type CreateRateLockInput = {
  partyId: string;
  productId: string;
  lockedPrice: number;
  validFrom: string;
  validUntil: string;
  notes?: string | null;
};

export async function createRateLock(input: CreateRateLockInput) {
  const res = await apiClient.post<RateLock>("/rate-locks", input);
  return res.data;
}

export async function listRateLocksForParty(partyId: string) {
  const res = await apiClient.get<RateLock[]>(`/rate-locks/party/${partyId}`);
  return res.data;
}

export async function listActiveRateLocksForParty(partyId: string) {
  const res = await apiClient.get<ActiveRateLock[]>(`/rate-locks/party/${partyId}`, { params: { active: "true" } });
  return res.data;
}
