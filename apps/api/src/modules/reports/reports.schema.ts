import { z } from "zod";

// Plain z.coerce.date() on a "YYYY-MM-DD" string parses it as UTC midnight — which is
// 5am in Asia/Karachi (UTC+5, no DST), so a "today" range built that way silently
// excludes almost the entire actual business day. These parse against the same
// Asia/Karachi calendar day the rest of reports.service.ts groups by (see `dayExpr`),
// so "today" really means today, start to end, in the timezone the shop operates in.
const karachiDayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const karachiDayStart = karachiDayString.transform((s) => new Date(`${s}T00:00:00+05:00`));
const karachiDayEnd = karachiDayString.transform((s) => new Date(`${s}T23:59:59.999+05:00`));

export const reportsQuerySchema = z.object({
  dateFrom: karachiDayStart,
  dateTo: karachiDayEnd,
});

export const topProductsQuerySchema = reportsQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const agingReportQuerySchema = z.object({
  partyType: z.enum(["customer", "supplier"]).default("customer"),
});

export const partyLedgerSummaryQuerySchema = reportsQuerySchema.extend({
  partyType: z.enum(["customer", "supplier"]).default("customer"),
});

export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;
export type AgingReportQuery = z.infer<typeof agingReportQuerySchema>;
export type PartyLedgerSummaryQuery = z.infer<typeof partyLedgerSummaryQuerySchema>;
