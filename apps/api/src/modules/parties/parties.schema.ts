import { z } from "zod";

export const createPartySchema = z.object({
  type: z.enum(["customer", "supplier"]),
  name: z.string().min(1).max(160),
  phone: z.string().max(30).nullable().optional(),
  cnic: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  // "Pichla baqaya" — what this party already owed (or was owed) before they were entered
  // into the system. Posted as a real ledger_entries row at creation time, same as every
  // other balance change — never written directly to cachedBalance.
  openingBalance: z
    .object({
      direction: z.enum(["debit", "credit"]),
      amount: z.coerce.number().positive(),
    })
    .nullable()
    .optional(),
});

export const updatePartySchema = z.object({
  name: z.string().min(1).max(160).optional(),
  phone: z.string().max(30).nullable().optional(),
  cnic: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
});

export const listPartiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(160).optional(),
  type: z.enum(["customer", "supplier"]).optional(),
  sort: z.enum(["recent", "balance"]).optional().default("recent"),
});

export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
export type ListPartiesQuery = z.infer<typeof listPartiesQuerySchema>;
