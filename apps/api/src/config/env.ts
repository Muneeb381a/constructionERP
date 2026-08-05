import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  // Only needed when the nightly reconciliation runs via Vercel Cron instead of the
  // in-process node-cron job (which doesn't survive on serverless) — see /api/admin/reconcile-all.
  cronSecret: process.env.CRON_SECRET,
  // Platform-admin (SaaS operator) auth — deliberately separate secrets from the tenant
  // JWTs above so a tenant token can never validate on a platform-admin route or vice versa.
  platformAdminJwtAccessSecret: required("PLATFORM_ADMIN_JWT_ACCESS_SECRET"),
  platformAdminJwtRefreshSecret: required("PLATFORM_ADMIN_JWT_REFRESH_SECRET"),
  platformAdminAccessTokenTtl: process.env.PLATFORM_ADMIN_ACCESS_TOKEN_TTL ?? "10m",
  platformAdminRefreshTokenTtlDays: Number(process.env.PLATFORM_ADMIN_REFRESH_TOKEN_TTL_DAYS ?? 5),
  // Optional comma-separated IP allowlist for platform-admin login; unset = no restriction.
  platformAdminIpAllowlist: process.env.PLATFORM_ADMIN_IP_ALLOWLIST?.split(",").map((s) => s.trim()).filter(Boolean),
};
