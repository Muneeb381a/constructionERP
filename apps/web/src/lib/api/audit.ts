import { apiClient } from "../apiClient";

export type AuditLogEntry = {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: string | null;
  afterData: string | null;
  createdAt: string;
};

export type AuditLogResponse = {
  data: AuditLogEntry[];
  page: number;
  limit: number;
  total: number;
};

export async function listAuditLog(params: { page?: number; action?: string; entityType?: string } = {}) {
  const res = await apiClient.get<AuditLogResponse>("/audit-log", { params });
  return res.data;
}
