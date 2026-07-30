import { z } from "zod";

export const createRateLockSchema = z
  .object({
    partyId: z.string().uuid(),
    productId: z.string().uuid(),
    lockedPrice: z.coerce.number().positive(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine((data) => data.validUntil > data.validFrom, {
    message: "validUntil must be after validFrom",
    path: ["validUntil"],
  });

export type CreateRateLockInput = z.infer<typeof createRateLockSchema>;
