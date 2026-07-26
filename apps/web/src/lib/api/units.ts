import { apiClient } from "../apiClient";

export type Unit = {
  id: number;
  tenantId: string;
  name: string;
  shortCode: string | null;
};

export async function listUnits() {
  const res = await apiClient.get<Unit[]>("/units");
  return res.data;
}
