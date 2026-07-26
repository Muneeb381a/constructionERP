import { z } from "zod";

export const createWarehouseSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
