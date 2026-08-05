import { z } from "zod";

export const listPlatformAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  targetTenantId: z.string().uuid().optional(),
  action: z.string().max(50).optional(),
});

export type ListPlatformAuditLogQuery = z.infer<typeof listPlatformAuditLogQuerySchema>;
