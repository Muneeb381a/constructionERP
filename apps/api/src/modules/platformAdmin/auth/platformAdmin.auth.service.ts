import { authenticator } from "otplib";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { platformAdmins, platformAdminRecoveryCodes, platformRefreshTokens } from "../../../db/schema.js";
import { HttpError } from "../../../middleware/error.middleware.js";
import { hashPassword, verifyPassword } from "../../../lib/password.js";
import {
  hashToken,
  signPlatformAccessToken,
  signPlatformRefreshToken,
  verifyPlatformRefreshToken,
} from "../../../lib/platformJwt.js";
import { env } from "../../../config/env.js";
import { recordPlatformAudit, type RequestMeta } from "../audit/platformAdmin.audit.service.js";
import type { PlatformLoginInput } from "./platformAdmin.auth.schema.js";

export type { RequestMeta };

async function issueTokenPair(platformAdminId: string, meta: RequestMeta) {
  const accessToken = signPlatformAccessToken(platformAdminId);
  const { token: refreshToken, jti } = signPlatformRefreshToken(platformAdminId);
  const expiresAt = new Date(Date.now() + env.platformAdminRefreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db.insert(platformRefreshTokens).values({
    id: jti,
    platformAdminId,
    tokenHash: hashToken(refreshToken),
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
    lastUsedAt: new Date(),
    expiresAt,
  });

  return { accessToken, refreshToken };
}

export async function platformLogin(input: PlatformLoginInput, meta: RequestMeta) {
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.email, input.email.toLowerCase()))
    .limit(1);

  if (!admin || !admin.isActive) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordOk = await verifyPassword(input.password, admin.passwordHash);
  if (!passwordOk) {
    throw new HttpError(401, "Invalid email or password");
  }

  if (input.totpCode) {
    if (!admin.totpSecret || !authenticator.check(input.totpCode, admin.totpSecret)) {
      throw new HttpError(401, "Invalid authentication code");
    }
  } else if (input.recoveryCode) {
    const codes = await db
      .select()
      .from(platformAdminRecoveryCodes)
      .where(and(eq(platformAdminRecoveryCodes.platformAdminId, admin.id), isNull(platformAdminRecoveryCodes.usedAt)));

    let matched: (typeof codes)[number] | undefined;
    for (const c of codes) {
      if (await verifyPassword(input.recoveryCode, c.codeHash)) {
        matched = c;
        break;
      }
    }
    if (!matched) throw new HttpError(401, "Invalid or already-used recovery code");
    await db.update(platformAdminRecoveryCodes).set({ usedAt: new Date() }).where(eq(platformAdminRecoveryCodes.id, matched.id));
  }

  const tokens = await issueTokenPair(admin.id, meta);
  await recordPlatformAudit(admin.id, "login", meta);

  return { admin: { id: admin.id, name: admin.name, email: admin.email }, ...tokens };
}

export async function platformRefresh(refreshToken: string, meta: RequestMeta) {
  let payload;
  try {
    payload = verifyPlatformRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const [stored] = await db
    .select()
    .from(platformRefreshTokens)
    .where(
      and(
        eq(platformRefreshTokens.id, payload.jti),
        eq(platformRefreshTokens.platformAdminId, payload.sub),
        eq(platformRefreshTokens.tokenHash, tokenHash),
        isNull(platformRefreshTokens.revokedAt),
        gt(platformRefreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!stored) {
    throw new HttpError(401, "Refresh token has been revoked or reused");
  }

  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, payload.sub)).limit(1);
  if (!admin || !admin.isActive) {
    throw new HttpError(401, "Account no longer active");
  }

  await db.update(platformRefreshTokens).set({ revokedAt: new Date() }).where(eq(platformRefreshTokens.id, stored.id));

  const tokens = await issueTokenPair(admin.id, meta);
  return { admin: { id: admin.id, name: admin.name, email: admin.email }, ...tokens };
}

export async function platformLogout(refreshToken: string) {
  try {
    const payload = verifyPlatformRefreshToken(refreshToken);
    await db
      .update(platformRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(platformRefreshTokens.id, payload.jti), isNull(platformRefreshTokens.revokedAt)));
  } catch {
    // already invalid/expired — logout is idempotent either way
  }
}

/** Used only by the create-platform-admin bootstrap script — never exposed over HTTP. */
export async function createPlatformAdminAccount(input: {
  name: string;
  email: string;
  password: string;
  totpSecret: string;
  recoveryCodes: string[];
}) {
  const passwordHash = await hashPassword(input.password);
  const recoveryHashes = await Promise.all(input.recoveryCodes.map((c) => hashPassword(c)));

  return db.transaction(async (tx) => {
    const [admin] = await tx
      .insert(platformAdmins)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        totpSecret: input.totpSecret,
        totpEnabledAt: new Date(),
      })
      .returning();

    await tx.insert(platformAdminRecoveryCodes).values(
      recoveryHashes.map((codeHash) => ({ platformAdminId: admin.id, codeHash })),
    );

    return admin;
  });
}
