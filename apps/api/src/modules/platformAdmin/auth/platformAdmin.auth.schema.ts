import { z } from "zod";

// Password + a 2FA code are required together in one request — there is no path that
// issues tokens on password alone. `totpCode` covers normal day-to-day login; `recoveryCode`
// is the one-time backup path if the authenticator device is lost. Exactly one of the two
// must be supplied.
export const platformLoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    totpCode: z.string().min(1).optional(),
    recoveryCode: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.totpCode) !== Boolean(v.recoveryCode), {
    message: "Provide exactly one of totpCode or recoveryCode",
  });

export const platformRefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const platformLogoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type PlatformRefreshInput = z.infer<typeof platformRefreshSchema>;
