import { apiClient } from "../apiClient";

export type Warehouse = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
};

export async function listWarehouses() {
  const res = await apiClient.get<Warehouse[]>("/warehouses");
  return res.data;
}

export async function createWarehouse(input: { branchId: string; name: string }) {
  const res = await apiClient.post<Warehouse>("/warehouses", input);
  return res.data;
}
