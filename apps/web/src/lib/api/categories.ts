import { apiClient } from "../apiClient";

export type Category = {
  id: number;
  tenantId: string;
  name: string;
  nameUrdu: string | null;
  parentId: number | null;
};

export async function listCategories() {
  const res = await apiClient.get<Category[]>("/categories");
  return res.data;
}
