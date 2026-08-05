import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { branches, invoices, platformAuditLog, refreshTokens, tenants, users, warehouses } from "../../../db/schema.js";
import { HttpError } from "../../../middleware/error.middleware.js";
import { hashPassword } from "../../../lib/password.js";
import { recordPlatformAudit, type RequestMeta } from "../audit/platformAdmin.audit.service.js";
import type { CreateTenantInput, ListTenantsQuery } from "./platformAdmin.tenants.schema.js";

function generateTemporaryPassword(): string {
  // 16 random bytes, base64url — short enough to type from a screen, long enough to be
  // a real credential; the owner is expected to change it after first login.
  return randomBytes(16).toString("base64url");
}

export async function listTenants(query: ListTenantsQuery) {
  const conditions = [];
  if (query.status) conditions.push(eq(tenants.status, query.status));
  if (query.search) conditions.push(ilike(tenants.businessName, `%${query.search}%`));
  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ id: tenants.id, businessName: tenants.businessName, status: tenants.status, createdAt: tenants.createdAt })
      .from(tenants)
      .where(where)
      .orderBy(desc(tenants.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(tenants).where(where),
  ]);

  if (rows.length === 0) return { data: [], page: query.page, limit: query.limit, total: count };

  const tenantIds = rows.map((r) => r.id);
  const owners = await db
    .select({ tenantId: users.tenantId, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, "owner"), inArray(users.tenantId, tenantIds)));
  const ownerByTenant = new Map(owners.map((o) => [o.tenantId, o]));

  const data = rows.map((r) => ({
    ...r,
    ownerName: ownerByTenant.get(r.id)?.name ?? null,
    ownerEmail: ownerByTenant.get(r.id)?.email ?? null,
  }));

  return { data, page: query.page, limit: query.limit, total: count };
}

export async function getTenantDetail(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new HttpError(404, "Tenant not found");

  const [tenantUsers, tenantBranches, liveDevices, invoiceCount] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, createdAt: users.createdAt })
      .from(users).where(eq(users.tenantId, tenantId)),
    db.select().from(branches).where(eq(branches.tenantId, tenantId)),
    db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        userName: users.name,
        userAgent: refreshTokens.userAgent,
        ipAddress: refreshTokens.ipAddress,
        lastUsedAt: refreshTokens.lastUsedAt,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .innerJoin(users, eq(users.id, refreshTokens.userId))
      .where(
        and(
          eq(refreshTokens.tenantId, tenantId),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(refreshTokens.lastUsedAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), ne(invoices.status, "void"))),
  ]);

  return {
    tenant,
    users: tenantUsers,
    branches: tenantBranches,
    liveDevices,
    metrics: { invoiceCount: invoiceCount[0]?.count ?? 0 },
  };
}

/**
 * Mirrors registerTenant()'s transaction shape (tenant + main branch + main warehouse +
 * owner user) but is admin-triggered: it must NEVER log the caller in as the new owner,
 * unlike registerTenant which is the public self-signup path.
 */
export async function platformCreateTenant(platformAdminId: string, input: CreateTenantInput, meta: RequestMeta) {
  const [existingAudit] = await db
    .select()
    .from(platformAuditLog)
    .where(and(eq(platformAuditLog.idempotencyKey, input.idempotencyKey), eq(platformAuditLog.action, "tenant_created")))
    .limit(1);

  if (existingAudit?.targetTenantId) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, existingAudit.targetTenantId)).limit(1);
    // The plaintext password is never stored, so a retry can't re-display it — the first
    // response is the only time it's ever shown.
    return { tenant, ownerEmail: input.email.toLowerCase(), ownerPassword: null, alreadyCreated: true };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const { tenant, user } = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ businessName: input.businessName, createdByPlatformAdminId: platformAdminId })
      .returning();

    const [branch] = await tx
      .insert(branches)
      .values({ tenantId: tenant.id, name: "Main Branch", isMain: true })
      .returning();

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

    return { tenant, user };
  });

  await recordPlatformAudit(platformAdminId, "tenant_created", meta, {
    targetTenantId: tenant.id,
    afterData: { businessName: tenant.businessName, ownerEmail: user.email, passwordAutoGenerated: true },
    idempotencyKey: input.idempotencyKey,
  });

  return { tenant, ownerEmail: user.email, ownerPassword: temporaryPassword, alreadyCreated: false };
}

async function revokeAllTenantSessions(tenantId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tenantId, tenantId), isNull(refreshTokens.revokedAt)));
}

export async function suspendTenant(platformAdminId: string, tenantId: string, reason: string | undefined, meta: RequestMeta) {
  const updated = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(tenants)
      .set({ status: "suspended", suspendedAt: new Date(), suspendedReason: reason ?? null })
      .where(and(eq(tenants.id, tenantId), eq(tenants.status, "active")))
      .returning();
    if (!updated) throw new HttpError(409, "Tenant is not in an active state");
    return updated;
  });

  await revokeAllTenantSessions(tenantId);
  await recordPlatformAudit(platformAdminId, "tenant_suspended", meta, { targetTenantId: tenantId, afterData: { reason } });
  return updated;
}

export async function reactivateTenant(platformAdminId: string, tenantId: string, meta: RequestMeta) {
  const [updated] = await db
    .update(tenants)
    .set({ status: "active", suspendedAt: null, suspendedReason: null })
    .where(and(eq(tenants.id, tenantId), eq(tenants.status, "suspended")))
    .returning();
  if (!updated) throw new HttpError(409, "Tenant is not currently suspended");

  await recordPlatformAudit(platformAdminId, "tenant_reactivated", meta, { targetTenantId: tenantId });
  return updated;
}

export async function closeTenant(platformAdminId: string, tenantId: string, reason: string | undefined, meta: RequestMeta) {
  const updated = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(tenants)
      .set({ status: "closed", closedAt: new Date(), closedReason: reason ?? null })
      .where(and(eq(tenants.id, tenantId), ne(tenants.status, "closed")))
      .returning();
    if (!updated) throw new HttpError(409, "Tenant is already closed");
    return updated;
  });

  await revokeAllTenantSessions(tenantId);
  await recordPlatformAudit(platformAdminId, "tenant_closed", meta, { targetTenantId: tenantId, afterData: { reason } });
  return updated;
}
