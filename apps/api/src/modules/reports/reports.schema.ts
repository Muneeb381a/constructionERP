import { z } from "zod";

export const reportsQuerySchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
});

export const topProductsQuerySchema = reportsQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const agingReportQuerySchema = z.object({
  partyType: z.enum(["customer", "supplier"]).default("customer"),
});

export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;
export type AgingReportQuery = z.infer<typeof agingReportQuerySchema>;
