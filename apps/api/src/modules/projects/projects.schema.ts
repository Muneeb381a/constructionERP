import { z } from "zod";

const estimateLineSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1).max(200),
  targetQuantity: z.number().nonnegative(),
  unitName: z.string().min(1).max(40),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(160),
  branchId: z.string().uuid(),
  partyId: z.string().uuid().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  estimateSnapshot: z.array(estimateLineSchema).max(20).optional(),
});

export const updateProjectStatusSchema = z.object({
  status: z.enum(["active", "completed", "on_hold"]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
