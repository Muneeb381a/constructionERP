import { z } from "zod";

export const createClosingSchema = z.object({
  countedCash: z.coerce.number().nonnegative(),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateClosingInput = z.infer<typeof createClosingSchema>;
