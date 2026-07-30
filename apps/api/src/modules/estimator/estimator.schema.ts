import { z } from "zod";

export const estimateSlipLineSchema = z.object({
  label: z.string().min(1).max(100),
  qty: z.number(),
  unit: z.string().min(1).max(20),
  productName: z.string().max(200).optional(),
  unitPrice: z.number().nonnegative().optional(),
});

export const estimateSlipSchema = z.object({
  title: z.string().min(1).max(100),
  dimensionsNote: z.string().max(200).optional(),
  customerName: z.string().max(200).optional(),
  lines: z.array(estimateSlipLineSchema).min(1).max(20),
});

export type EstimateSlipInput = z.infer<typeof estimateSlipSchema>;
