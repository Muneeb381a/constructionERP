import { z } from "zod";

export const createQuotationSchema = z.object({
  branchId: z.string().uuid(),
  partyId: z.string().uuid().nullable().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        unitId: z.number().int().positive(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().nonnegative().optional(),
      }),
    )
    .min(1, "At least one line item is required"),
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(["sent", "accepted", "rejected", "expired"]),
});

export const convertQuotationSchema = z.object({
  warehouseId: z.string().uuid(),
  overrideCreditLimit: z.boolean().optional(),
});

export const listQuotationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]).optional(),
  partyId: z.string().uuid().optional(),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>;
export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>;
