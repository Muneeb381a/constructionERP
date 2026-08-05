import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { platformAdmins, platformAuditLog, tenants } from "../../../db/schema.js";
import type { ListPlatformAuditLogQuery } from "./platformAdmin.audit.schema.js";

export type RequestMeta = { ipAddress: string | null; userAgent: string | null };

/**
 * Sole writer for platform_audit_log — append-only by convention, same discipline as
 * ledger_entries. No update/delete function exists for this table anywhere in the app.
 * `afterData` must never contain a plaintext password or TOTP secret.
 */
export async function recordPlatformAudit(
  platformAdminId: string,
  action: string,
  meta: RequestMeta,
  extra?: { targetTenantId?: string; beforeData?: unknown; afterData?: unknown; idempotencyKey?: string },
) {
  await db.insert(platformAuditLog).values({
    platformAdminId,
    action,
    targetTenantId: extra?.targetTenantId,
    beforeData: extra?.beforeData ? JSON.stringify(extra.beforeData) : null,
    afterData: extra?.afterData ? JSON.stringify(extra.afterData) : null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    idempotencyKey: extra?.idempotencyKey,
  });
}

export async function listPlatformAuditLog(query: ListPlatformAuditLogQuery) {
  const conditions = [];
  if (query.targetTenantId) conditions.push(eq(platformAuditLog.targetTenantId, query.targetTenantId));
  if (query.action) conditions.push(eq(platformAuditLog.action, query.action));

  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: platformAuditLog.id,
        platformAdminId: platformAuditLog.platformAdminId,
        adminName: platformAdmins.name,
        action: platformAuditLog.action,
        targetTenantId: platformAuditLog.targetTenantId,
        targetTenantName: tenants.businessName,
        beforeData: platformAuditLog.beforeData,
        afterData: platformAuditLog.afterData,
        ipAddress: platformAuditLog.ipAddress,
        createdAt: platformAuditLog.createdAt,
      })
      .from(platformAuditLog)
      .leftJoin(platformAdmins, eq(platformAdmins.id, platformAuditLog.platformAdminId))
      .leftJoin(tenants, eq(tenants.id, platformAuditLog.targetTenantId))
      .where(where)
      .orderBy(desc(platformAuditLog.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(platformAuditLog).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}
