import { apiClient } from "../apiClient";

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  nameUrdu: string | null;
  categoryId: number | null;
  baseUnitId: number;
  barcode: string | null;
  imageUrl: string | null;
  purchasePrice: string;
  salePrice: string;
  minStock: string;
  maxStock: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ProductListResponse = {
  data: Product[];
  page: number;
  limit: number;
  total: number;
};

export type ProductInput = {
  name: string;
  nameUrdu?: string | null;
  categoryId?: number | null;
  baseUnitId: number;
  barcode?: string | null;
  purchasePrice?: number;
  salePrice?: number;
  minStock?: number;
  maxStock?: number | null;
};

export async function listProducts(params: { search?: string; categoryId?: number; page?: number } = {}) {
  const res = await apiClient.get<ProductListResponse>("/products", { params });
  return res.data;
}

export async function getProduct(id: string) {
  const res = await apiClient.get<Product>(`/products/${id}`);
  return res.data;
}

export type RateHistoryPoint = { rate: string; effectiveFrom: string };

export async function getRateHistory(id: string) {
  const res = await apiClient.get<RateHistoryPoint[]>(`/products/${id}/rate-history`);
  return res.data;
}

export async function createProduct(input: ProductInput) {
  const res = await apiClient.post<Product>("/products", input);
  return res.data;
}

export async function updateProduct(id: string, input: Partial<ProductInput> & { isActive?: boolean }) {
  const res = await apiClient.patch<Product>(`/products/${id}`, input);
  return res.data;
}

export type ProductUnitConversion = {
  id: number;
  productId: string;
  fromUnitId: number;
  toBaseUnitFactor: string;
};

export async function listProductConversions(productId: string) {
  const res = await apiClient.get<ProductUnitConversion[]>(`/products/${productId}/conversions`);
  return res.data;
}

export type BulkPriceUpdateInput = {
  categoryId?: number;
  productIds?: string[];
  priceField: "salePrice" | "purchasePrice" | "both";
  adjustmentType: "percentage" | "fixed";
  adjustmentValue: number;
};

export type BulkPriceUpdateResult = {
  updated: {
    productId: string;
    name: string;
    oldSalePrice: string;
    newSalePrice: string;
    oldPurchasePrice: string;
    newPurchasePrice: string;
  }[];
};

export async function bulkUpdatePrices(input: BulkPriceUpdateInput) {
  const res = await apiClient.post<BulkPriceUpdateResult>("/products/bulk-price-update", input);
  return res.data;
}

export async function uploadProductImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await apiClient.post<Product>(`/products/${id}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
