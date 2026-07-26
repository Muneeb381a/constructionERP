import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { productUnitConversions, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateConversionInput } from "./products.schema.js";
import { getProduct } from "./products.service.js";

export async function listConversions(tenantId: string, productId: string) {
  await getProduct(tenantId, productId); // 404s if product isn't in this tenant
  return db.select().from(productUnitConversions).where(eq(productUnitConversions.productId, productId));
}

export async function createConversion(tenantId: string, productId: string, input: CreateConversionInput) {
  await getProduct(tenantId, productId);

  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, input.fromUnitId), eq(units.tenantId, tenantId)))
    .limit(1);
  if (!unit) throw new HttpError(400, "fromUnitId does not refer to a unit in this tenant");

  const [conversion] = await db
    .insert(productUnitConversions)
    .values({
      productId,
      fromUnitId: input.fromUnitId,
      toBaseUnitFactor: input.toBaseUnitFactor.toString(),
    })
    .returning();

  return conversion;
}

export async function deleteConversion(tenantId: string, productId: string, conversionId: number) {
  await getProduct(tenantId, productId);

  const [deleted] = await db
    .delete(productUnitConversions)
    .where(and(eq(productUnitConversions.id, conversionId), eq(productUnitConversions.productId, productId)))
    .returning({ id: productUnitConversions.id });

  if (!deleted) throw new HttpError(404, "Conversion not found");
}
