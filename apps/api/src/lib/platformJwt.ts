import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { hashToken } from "./jwt.js";

// Deliberately separate from lib/jwt.ts (different secrets, different payload shape) so a
// tenant-user token can never validate here and a platform-admin token can never validate
// against the tenant `authenticate` middleware, even if some future edit accidentally
// reused a verify function across the two.

export type PlatformAccessTokenPayload = {
  sub: string; // platformAdminId
  type: "platform_admin";
};

export type PlatformRefreshTokenPayload = {
  sub: string;
  jti: string;
  type: "platform_admin";
};

export function signPlatformAccessToken(platformAdminId: string): string {
  return jwt.sign(
    { sub: platformAdminId, type: "platform_admin" } satisfies PlatformAccessTokenPayload,
    env.platformAdminJwtAccessSecret,
    { expiresIn: env.platformAdminAccessTokenTtl as jwt.SignOptions["expiresIn"] },
  );
}

export function verifyPlatformAccessToken(token: string): PlatformAccessTokenPayload {
  const payload = jwt.verify(token, env.platformAdminJwtAccessSecret) as PlatformAccessTokenPayload;
  if (payload.type !== "platform_admin") throw new Error("Not a platform-admin token");
  return payload;
}

export function signPlatformRefreshToken(platformAdminId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: platformAdminId, jti, type: "platform_admin" } satisfies PlatformRefreshTokenPayload,
    env.platformAdminJwtRefreshSecret,
    { expiresIn: `${env.platformAdminRefreshTokenTtlDays}d` },
  );
  return { token, jti };
}

export function verifyPlatformRefreshToken(token: string): PlatformRefreshTokenPayload {
  const payload = jwt.verify(token, env.platformAdminJwtRefreshSecret) as PlatformRefreshTokenPayload;
  if (payload.type !== "platform_admin") throw new Error("Not a platform-admin token");
  return payload;
}

export { hashToken };
