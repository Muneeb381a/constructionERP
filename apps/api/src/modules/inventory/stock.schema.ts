import { z } from "zod";

export const adjustStockSchema = z.object({
  idempotencyKey: z.string().uuid(),
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantityChange: z.coerce.number().refine((n) => n !== 0, "quantityChange must not be zero"),
});

export const createTransferSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    productId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    note: z.string().max(300).nullable().optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "fromWarehouseId and toWarehouseId must be different",
    path: ["toWarehouseId"],
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
