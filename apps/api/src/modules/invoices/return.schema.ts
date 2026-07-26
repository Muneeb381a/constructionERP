import { z } from "zod";

export const createReturnInvoiceSchema = z.object({
  idempotencyKey: z.string().uuid(),
  originalInvoiceId: z.string().uuid(),
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        unitId: z.number().int().positive(),
        quantity: z.coerce.number().positive(),
      }),
    )
    .min(1, "At least one line item is required"),
});

export type CreateReturnInvoiceInput = z.infer<typeof createReturnInvoiceSchema>;
