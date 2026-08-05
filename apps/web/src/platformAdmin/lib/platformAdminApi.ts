import { platformApiClient } from "./platformApiClient";

export type TenantStatus = "active" | "suspended" | "closed";

export type TenantSummary = {
  id: string;
  businessName: string;
  status: TenantStatus;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type TenantUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export type TenantDevice = {
  id: string;
  userId: string;
  userName: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
};

export type TenantDetail = {
  tenant: {
    id: string;
    businessName: string;
    status: TenantStatus;
    suspendedAt: string | null;
    suspendedReason: string | null;
    closedAt: string | null;
    closedReason: string | null;
    createdAt: string;
  };
  users: TenantUser[];
  branches: { id: string; name: string; isMain: boolean | null }[];
  liveDevices: TenantDevice[];
  metrics: { invoiceCount: number };
};

export type PlatformAuditEntry = {
  id: string;
  platformAdminId: string;
  adminName: string | null;
  action: string;
  targetTenantId: string | null;
  targetTenantName: string | null;
  beforeData: string | null;
  afterData: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type Paginated<T> = { data: T[]; page: number; limit: number; total: number };

export async function loginPlatformAdmin(input: {
  email: string;
  password: string;
  totpCode?: string;
  recoveryCode?: string;
}) {
  const res = await platformApiClient.post("/auth/login", input);
  return res.data as { admin: { id: string; name: string; email: string }; accessToken: string; refreshToken: string };
}

export async function logoutPlatformAdmin(refreshToken: string) {
  await platformApiClient.post("/auth/logout", { refreshToken });
}

export async function listTenants(params: { search?: string; status?: TenantStatus; page?: number } = {}) {
  const res = await platformApiClient.get<Paginated<TenantSummary>>("/tenants", { params });
  return res.data;
}

export async function getTenantDetail(tenantId: string) {
  const res = await platformApiClient.get<TenantDetail>(`/tenants/${tenantId}`);
  return res.data;
}

export async function createTenant(input: { businessName: string; ownerName: string; email: string; idempotencyKey: string }) {
  const res = await platformApiClient.post<{
    tenant: { id: string; businessName: string };
    ownerEmail: string;
    ownerPassword: string | null;
    alreadyCreated: boolean;
  }>("/tenants", input);
  return res.data;
}

export async function suspendTenant(tenantId: string, reason?: string) {
  const res = await platformApiClient.post(`/tenants/${tenantId}/suspend`, { reason });
  return res.data;
}

export async function reactivateTenant(tenantId: string) {
  const res = await platformApiClient.post(`/tenants/${tenantId}/reactivate`);
  return res.data;
}

export async function closeTenant(tenantId: string, reason?: string) {
  const res = await platformApiClient.post(`/tenants/${tenantId}/close`, { reason });
  return res.data;
}

export async function listPlatformAuditLog(params: { targetTenantId?: string; page?: number } = {}) {
  const res = await platformApiClient.get<Paginated<PlatformAuditEntry>>("/audit-log", { params });
  return res.data;
}
