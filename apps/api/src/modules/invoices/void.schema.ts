import { z } from "zod";

export const voidInvoiceSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;
