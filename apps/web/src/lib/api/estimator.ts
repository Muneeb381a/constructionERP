import { apiClient } from "../apiClient";

export type EstimateSlipLine = { label: string; qty: number; unit: string; productName?: string; unitPrice?: number };
export type EstimateSlipInput = { title: string; dimensionsNote?: string; customerName?: string; lines: EstimateSlipLine[] };

export async function downloadEstimateSlip(input: EstimateSlipInput) {
  const res = await apiClient.post("/estimator/pdf", input, { responseType: "blob" });
  return res.data as Blob;
}
