import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { UpdateTenantInput } from "./tenants.schema.js";

export async function getTenant(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new HttpError(404, "Tenant not found");
  return tenant;
}

export async function updateTenant(tenantId: string, input: UpdateTenantInput) {
  const [updated] = await db.update(tenants).set(input).where(eq(tenants.id, tenantId)).returning();
  if (!updated) throw new HttpError(404, "Tenant not found");
  return updated;
}

export async function setTenantLogo(tenantId: string, logoUrl: string) {
  const [updated] = await db.update(tenants).set({ logoUrl }).where(eq(tenants.id, tenantId)).returning();
  if (!updated) throw new HttpError(404, "Tenant not found");
  return updated;
}
