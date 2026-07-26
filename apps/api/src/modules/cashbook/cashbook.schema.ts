import { z } from "zod";

export const createCashBookEntrySchema = z.object({
  branchId: z.string().uuid(),
  direction: z.enum(["debit", "credit"]), // debit = cash in, credit = cash out
  amount: z.coerce.number().positive(),
  description: z.string().max(500).nullable().optional(),
});

export const listCashBookQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  branchId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateCashBookEntryInput = z.infer<typeof createCashBookEntrySchema>;
export type ListCashBookQuery = z.infer<typeof listCashBookQuerySchema>;
