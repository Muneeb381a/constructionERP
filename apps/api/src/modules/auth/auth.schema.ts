import { z } from "zod";

export const registerSchema = z.object({
  businessName: z.string().min(2).max(160),
  ownerName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
