import { z } from "zod";

export const postManualEntrySchema = z.object({
  direction: z.enum(["debit", "credit"]),
  amount: z.coerce.number().positive(),
});

export type PostManualEntryInput = z.infer<typeof postManualEntrySchema>;
