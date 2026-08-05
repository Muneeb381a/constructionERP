import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { branches, refreshTokens, tenants, users, warehouses } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { env } from "../../config/env.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

type AuthedUser = {
  id: string;
  tenantId: string;
  branchId: string | null;
  role: "owner" | "manager" | "cashier" | "accountant";
};

// Captured at login/register/refresh so a platform admin can see "which devices are
// logged into this shop" (GET /platform-admin/tenants/:id) without a separate session table.
export type RequestMeta = { ipAddress: string | null; userAgent: string | null };

async function issueTokenPair(user: AuthedUser, meta: RequestMeta) {
  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
  });

  const { token: refreshToken, jti } = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    id: jti,
    userId: user.id,
    tenantId: user.tenantId,
    tokenHash: hashToken(refreshToken),
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
    lastUsedAt: new Date(),
    expiresAt,
  });

  return { accessToken, refreshToken };
}

async function assertTenantActive(tenantId: string) {
  const [tenant] = await db.select({ status: tenants.status }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    throw new HttpError(403, "This shop's account has been suspended. Contact support.");
  }
}

export async function registerTenant(input: RegisterInput, meta: RequestMeta) {
  const passwordHash = await hashPassword(input.password);

  // issueTokenPair writes to refresh_tokens via the outer `db`, so the tenant/branch/user
  // insert must be committed first — otherwise the FK to users.id isn't visible yet.
  const { tenant, branch, user } = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ businessName: input.businessName })
      .returning();

    const [branch] = await tx
      .insert(branches)
      .values({ tenantId: tenant.id, name: "Main Branch", isMain: true })
      .returning();

    // Most tenants are a single shop with a single stockroom — auto-provision it so
    // stock tracking works immediately without the owner ever having to think about
    // "warehouses" as a concept.
    await tx.insert(warehouses).values({ tenantId: tenant.id, branchId: branch.id, name: "Main Store" });

    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        branchId: branch.id,
        name: input.ownerName,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "owner",
      })
      .returning();

    return { tenant, branch, user };
  });

  const tokens = await issueTokenPair(
    {
      id: user.id,
      tenantId: tenant.id,
      branchId: branch.id,
      role: user.role,
    },
    meta,
  );

  return { tenant, branch, user, ...tokens };
}

export async function login(input: LoginInput, meta: RequestMeta) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user || !user.isActive) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    throw new HttpError(401, "Invalid email or password");
  }

  await assertTenantActive(user.tenantId);

  const tokens = await issueTokenPair(
    {
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
    },
    meta,
  );

  return { user, ...tokens };
}

export async function refresh(refreshToken: string, meta: RequestMeta) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.id, payload.jti),
        eq(refreshTokens.userId, payload.sub),
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!stored) {
    throw new HttpError(401, "Refresh token has been revoked or reused");
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || !user.isActive) {
    throw new HttpError(401, "User account no longer active");
  }

  await assertTenantActive(user.tenantId);

  // rotate: revoke the used token before issuing a new pair
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, stored.id));

  const tokens = await issueTokenPair(
    {
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
    },
    meta,
  );

  return { user, ...tokens };
}

export async function logout(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, payload.jti), isNull(refreshTokens.revokedAt)));
  } catch {
    // already invalid/expired — logout is idempotent either way
  }
}
