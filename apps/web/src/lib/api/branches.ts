import { apiClient } from "../apiClient";

export type Branch = {
  id: string;
  tenantId: string;
  name: string;
  isMain: boolean;
};

export async function listBranches() {
  const res = await apiClient.get<Branch[]>("/branches");
  return res.data;
}
