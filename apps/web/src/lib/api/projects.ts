import { apiClient } from "../apiClient";
import type { Invoice } from "./invoices";

export type ProjectEstimateLine = { productId: string; productName: string; targetQuantity: number; unitName: string };

export type Project = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  partyId: string | null;
  address: string | null;
  status: "active" | "completed" | "on_hold";
  estimateSnapshot: ProjectEstimateLine[] | null;
  notes: string | null;
  createdAt: string;
};

export type ProjectProgressLine = {
  productId: string;
  productName: string;
  unitName: string;
  targetQuantity: number | null;
  suppliedQuantity: number;
};

export type ProjectWithProgress = {
  project: Project;
  invoices: Invoice[];
  progress: ProjectProgressLine[];
};

export type CreateProjectInput = {
  name: string;
  branchId: string;
  partyId?: string | null;
  address?: string | null;
  notes?: string | null;
  estimateSnapshot?: ProjectEstimateLine[];
};

export async function createProject(input: CreateProjectInput) {
  const res = await apiClient.post<Project>("/projects", input);
  return res.data;
}

export async function listProjects(params: { partyId?: string } = {}) {
  const res = await apiClient.get<Project[]>("/projects", { params });
  return res.data;
}

export async function getProject(id: string) {
  const res = await apiClient.get<ProjectWithProgress>(`/projects/${id}`);
  return res.data;
}

export async function updateProjectStatus(id: string, status: Project["status"]) {
  const res = await apiClient.patch<Project>(`/projects/${id}/status`, { status });
  return res.data;
}
