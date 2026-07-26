import { z } from "zod";

export const createPaymentSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    partyId: z.string().uuid(),
    invoiceId: z.string().uuid().nullable().optional(),
    method: z.enum(["cash", "bank_transfer", "cheque"]),
    amount: z.coerce.number().positive(),
    note: z.string().nullable().optional(),
    cheque: z
      .object({
        chequeNo: z.string().min(1).max(40),
        bankName: z.string().max(120).nullable().optional(),
        dueDate: z.coerce.date(),
      })
      .optional(),
  })
  .refine((data) => data.method !== "cheque" || data.cheque, {
    message: "cheque details are required when method is 'cheque'",
    path: ["cheque"],
  });

export const updateChequeStatusSchema = z.object({
  status: z.enum(["cleared", "bounced"]),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdateChequeStatusInput = z.infer<typeof updateChequeStatusSchema>;
