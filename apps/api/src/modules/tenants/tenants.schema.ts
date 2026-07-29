import { z } from "zod";

export const updateTenantSchema = z.object({
  businessName: z.string().min(2).max(160).optional(),
  address: z.string().max(250).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  allowNegativeStock: z.boolean().optional(),
  reminderIntervalDays: z.coerce.number().int().min(1).max(90).optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
