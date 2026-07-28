import { apiClient } from "../apiClient";

export type Tenant = {
  id: string;
  businessName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  allowNegativeStock: boolean;
  defaultCurrency: string;
  createdAt: string;
};

export type UpdateTenantInput = {
  businessName?: string;
  address?: string | null;
  phone?: string | null;
  allowNegativeStock?: boolean;
};

export async function getMyTenant() {
  const res = await apiClient.get<Tenant>("/tenants/me");
  return res.data;
}

export async function updateTenant(input: UpdateTenantInput) {
  const res = await apiClient.patch<Tenant>("/tenants/me", input);
  return res.data;
}

export async function uploadTenantLogo(file: File) {
  const formData = new FormData();
  formData.append("logo", file);
  const res = await apiClient.post<Tenant>("/tenants/me/logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
