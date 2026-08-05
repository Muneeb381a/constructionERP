import { z } from "zod";

export const postManualEntrySchema = z.object({
  idempotencyKey: z.string().uuid(),
  direction: z.enum(["debit", "credit"]),
  amount: z.coerce.number().positive(),
});

export type PostManualEntryInput = z.infer<typeof postManualEntrySchema>;
