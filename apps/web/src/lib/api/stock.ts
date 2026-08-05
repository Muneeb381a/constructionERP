import { apiClient } from "../apiClient";

export type StockByWarehouseRow = {
  id: number;
  productId: string;
  productName: string;
  warehouseId: string;
  quantity: string;
  version: number;
  categoryId: number | null;
  categoryName: string | null;
  unitId: number;
  unitName: string;
  minStock: string | null;
  maxStock: string | null;
};

export type StockMovement = {
  id: string;
  warehouseId: string;
  quantityChange: string;
  reason: string;
  referenceId: string | null;
  createdAt: string;
};

export type StockTransfer = {
  id: string;
  tenantId: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: string;
  note: string | null;
  idempotencyKey: string;
  createdBy: string | null;
  createdAt: string;
};

export async function listStockByWarehouse(warehouseId: string) {
  const res = await apiClient.get<StockByWarehouseRow[]>(`/stock/by-warehouse/${warehouseId}`);
  return res.data;
}

export async function listStockMovements(productId: string) {
  const res = await apiClient.get<StockMovement[]>(`/stock/movements/${productId}`);
  return res.data;
}

export async function adjustStock(input: { idempotencyKey: string; productId: string; warehouseId: string; quantityChange: number }) {
  const res = await apiClient.post("/stock/adjust", input);
  return res.data;
}

export type CreateTransferInput = {
  idempotencyKey: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  note?: string | null;
};

export async function createTransfer(input: CreateTransferInput) {
  const res = await apiClient.post<{ transfer: StockTransfer; idempotentReplay: boolean }>("/stock/transfers", input);
  return res.data;
}

export async function listTransfers(params: { productId?: string; warehouseId?: string } = {}) {
  const res = await apiClient.get<StockTransfer[]>("/stock/transfers", { params });
  return res.data;
}
