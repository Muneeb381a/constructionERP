import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateUnitInput, UpdateUnitInput } from "./units.schema.js";

export function listUnits(tenantId: string) {
  return db.select().from(units).where(eq(units.tenantId, tenantId));
}

export async function createUnit(tenantId: string, input: CreateUnitInput) {
  const [unit] = await db
    .insert(units)
    .values({ tenantId, name: input.name, shortCode: input.shortCode ?? null })
    .returning();
  return unit;
}

export async function updateUnit(tenantId: string, unitId: number, input: UpdateUnitInput) {
  const [updated] = await db
    .update(units)
    .set(input)
    .where(and(eq(units.id, unitId), eq(units.tenantId, tenantId)))
    .returning();

  if (!updated) throw new HttpError(404, "Unit not found");
  return updated;
}

export async function deleteUnit(tenantId: string, unitId: number) {
  try {
    const [deleted] = await db
      .delete(units)
      .where(and(eq(units.id, unitId), eq(units.tenantId, tenantId)))
      .returning({ id: units.id });

    if (!deleted) throw new HttpError(404, "Unit not found");
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as { code?: string }).code === "23503") {
      throw new HttpError(409, "Unit is still in use by products or conversions — it can't be deleted");
    }
    throw err;
  }
}
