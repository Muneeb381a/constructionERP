import { z } from "zod";

export const createUnitSchema = z.object({
  name: z.string().min(1).max(40),
  shortCode: z.string().max(10).nullable().optional(),
});

export const updateUnitSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  shortCode: z.string().max(10).nullable().optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
