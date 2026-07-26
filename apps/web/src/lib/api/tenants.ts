import { apiClient } from "../apiClient";

export type Tenant = {
  id: string;
  businessName: string;
  allowNegativeStock: boolean;
  defaultCurrency: string;
  createdAt: string;
};

export async function getMyTenant() {
  const res = await apiClient.get<Tenant>("/tenants/me");
  return res.data;
}
