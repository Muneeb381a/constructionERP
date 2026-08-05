import { apiClient } from "../apiClient";

export type Category = {
  id: number;
  tenantId: string;
  name: string;
  nameUrdu: string | null;
  parentId: number | null;
};

export type CategoryInput = {
  name: string;
  nameUrdu?: string | null;
  parentId?: number | null;
};

export async function listCategories() {
  const res = await apiClient.get<Category[]>("/categories");
  return res.data;
}

export async function createCategory(input: CategoryInput) {
  const res = await apiClient.post<Category>("/categories", input);
  return res.data;
}

export async function updateCategory(id: number, input: Partial<CategoryInput>) {
  const res = await apiClient.patch<Category>(`/categories/${id}`, input);
  return res.data;
}

export async function deleteCategory(id: number) {
  await apiClient.delete(`/categories/${id}`);
}
