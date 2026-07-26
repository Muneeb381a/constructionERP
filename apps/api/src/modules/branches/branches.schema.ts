import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(2).max(120),
});

export const updateBranchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  isMain: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
