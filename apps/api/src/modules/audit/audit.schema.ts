import { z } from "zod";

export const listAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
  action: z.string().max(40).optional(),
  entityType: z.string().max(40).optional(),
});

export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
