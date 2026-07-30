import { z } from "zod";

export const createSaleInvoiceSchema = z.object({
  idempotencyKey: z.string().uuid(),
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  partyId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  overrideCreditLimit: z.boolean().optional(),
  payment: z
    .object({
      method: z.enum(["cash", "bank_transfer"]),
      amount: z.coerce.number().positive(),
      note: z.string().nullable().optional(),
    })
    .optional(),
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

export type CreateSaleInvoiceInput = z.infer<typeof createSaleInvoiceSchema>;
