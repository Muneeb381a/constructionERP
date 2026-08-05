import { z } from "zod";

export const createTenantSchema = z.object({
  businessName: z.string().min(1).max(160),
  ownerName: z.string().min(1).max(120),
  email: z.string().email(),
  idempotencyKey: z.string().uuid(),
});

export const suspendTenantSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const closeTenantSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(160).optional(),
  status: z.enum(["active", "suspended", "closed"]).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;
export type CloseTenantInput = z.infer<typeof closeTenantSchema>;
export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;
