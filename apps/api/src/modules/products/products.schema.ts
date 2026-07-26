import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1).max(160),
  nameUrdu: z.string().max(160).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  baseUnitId: z.number().int().positive(),
  barcode: z.string().max(60).nullable().optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  minStock: z.coerce.number().nonnegative().optional(),
  maxStock: z.coerce.number().positive().nullable().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  nameUrdu: z.string().max(160).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  baseUnitId: z.number().int().positive().optional(),
  barcode: z.string().max(60).nullable().optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  minStock: z.coerce.number().nonnegative().optional(),
  maxStock: z.coerce.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(160).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const createConversionSchema = z.object({
  fromUnitId: z.number().int().positive(),
  toBaseUnitFactor: z.coerce.number().positive(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateConversionInput = z.infer<typeof createConversionSchema>;
