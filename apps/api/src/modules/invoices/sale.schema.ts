import { z } from "zod";

// Named add-on charges — loader/rolly labor, freight, etc. — added on top of the item
// subtotal. A free-text label rather than a fixed enum: shops name these however they
// think of them, and there's no shared catalog of "charge types" to keep consistent.
export const invoiceChargeSchema = z.object({
  label: z.string().min(1).max(60),
  amount: z.coerce.number().positive(),
});

export const createSaleInvoiceSchema = z.object({
  idempotencyKey: z.string().uuid(),
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  partyId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  otherCharges: z.array(invoiceChargeSchema).max(10).optional(),
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
export type InvoiceCharge = z.infer<typeof invoiceChargeSchema>;
