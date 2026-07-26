import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

export async function getTenant(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new HttpError(404, "Tenant not found");
  return tenant;
}
