import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  nameUrdu: z.string().max(100).nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameUrdu: z.string().max(100).nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
