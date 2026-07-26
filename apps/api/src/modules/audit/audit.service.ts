import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { auditLog, users } from "../../db/schema.js";
import type { ListAuditLogQuery } from "./audit.schema.js";

export async function listAuditLog(tenantId: string, query: ListAuditLogQuery) {
  const conditions = [eq(auditLog.tenantId, tenantId)];
  if (query.action) conditions.push(eq(auditLog.action, query.action));
  if (query.entityType) conditions.push(eq(auditLog.entityType, query.entityType));

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        userName: users.name,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        beforeData: auditLog.beforeData,
        afterData: auditLog.afterData,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}
