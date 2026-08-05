import { apiClient } from "../apiClient";

export type Unit = {
  id: number;
  tenantId: string;
  name: string;
  shortCode: string | null;
};

export type UnitInput = {
  name: string;
  shortCode?: string | null;
};

export async function listUnits() {
  const res = await apiClient.get<Unit[]>("/units");
  return res.data;
}

export async function createUnit(input: UnitInput) {
  const res = await apiClient.post<Unit>("/units", input);
  return res.data;
}

export async function updateUnit(id: number, input: Partial<UnitInput>) {
  const res = await apiClient.patch<Unit>(`/units/${id}`, input);
  return res.data;
}

export async function deleteUnit(id: number) {
  await apiClient.delete(`/units/${id}`);
}
