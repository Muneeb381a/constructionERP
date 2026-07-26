import { z } from "zod";

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["sale", "purchase", "sale_return", "purchase_return"]).optional(),
  partyId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const assignDeliverySchema = z.object({
  employeeId: z.string().uuid(),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>;
