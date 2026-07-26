import { z } from "zod";

export const createExpenseSchema = z.object({
  branchId: z.string().uuid(),
  category: z.string().min(1).max(60),
  amount: z.coerce.number().positive(),
  description: z.string().max(500).nullable().optional(),
  method: z.enum(["cash", "bank_transfer", "cheque"]).default("cash"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // defaults to today (Asia/Karachi) if omitted
});

export const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  branchId: z.string().uuid().optional(),
  category: z.string().max(60).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
