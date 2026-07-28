import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categories, products, rateHistory, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { BulkPriceUpdateInput, CreateProductInput, ListProductsQuery, UpdateProductInput } from "./products.schema.js";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

async function assertCategoryInTenant(tenantId: string, categoryId: number | null | undefined) {
  if (categoryId == null) return;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new HttpError(400, "categoryId does not refer to a category in this tenant");
}

async function assertUnitInTenant(tenantId: string, unitId: number) {
  const [row] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new HttpError(400, "baseUnitId does not refer to a unit in this tenant");
}

export async function listProducts(tenantId: string, query: ListProductsQuery) {
  const conditions = [eq(products.tenantId, tenantId)];
  if (!query.includeInactive) conditions.push(eq(products.isActive, true));
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
  if (query.search) conditions.push(ilike(products.name, `%${query.search}%`));

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(query.limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}

export async function getProduct(tenantId: string, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .limit(1);
  if (!product) throw new HttpError(404, "Product not found");
  return product;
}

export async function createProduct(tenantId: string, input: CreateProductInput) {
  await assertCategoryInTenant(tenantId, input.categoryId);
  await assertUnitInTenant(tenantId, input.baseUnitId);

  const [product] = await db
    .insert(products)
    .values({
      tenantId,
      name: input.name,
      nameUrdu: input.nameUrdu ?? null,
      categoryId: input.categoryId ?? null,
      baseUnitId: input.baseUnitId,
      barcode: input.barcode ?? null,
      purchasePrice: input.purchasePrice?.toString() ?? "0",
      salePrice: input.salePrice?.toString() ?? "0",
      minStock: input.minStock?.toString() ?? "0",
      maxStock: input.maxStock != null ? input.maxStock.toString() : null,
    })
    .returning();

  if (input.salePrice != null) {
    await db.insert(rateHistory).values({ productId: product.id, rate: input.salePrice.toString() });
  }

  return product;
}

export async function updateProduct(tenantId: string, productId: string, input: UpdateProductInput) {
  await assertCategoryInTenant(tenantId, input.categoryId);
  if (input.baseUnitId != null) await assertUnitInTenant(tenantId, input.baseUnitId);

  const current = await getProduct(tenantId, productId);

  const [updated] = await db
    .update(products)
    .set({
      ...input,
      purchasePrice: input.purchasePrice != null ? input.purchasePrice.toString() : undefined,
      salePrice: input.salePrice != null ? input.salePrice.toString() : undefined,
      minStock: input.minStock != null ? input.minStock.toString() : undefined,
      maxStock: input.maxStock === undefined ? undefined : input.maxStock == null ? null : input.maxStock.toString(),
    })
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .returning();

  if (input.salePrice != null && input.salePrice.toString() !== current.salePrice) {
    await db.insert(rateHistory).values({ productId, rate: input.salePrice.toString() });
  }

  return updated;
}

/**
 * Adjusts sale/purchase prices for a whole category (or an explicit product selection) in
 * one action — steel and cement rates move weekly in this market, and re-editing every
 * product by hand every time the mill announces a new rate isn't realistic for a shop owner.
 */
export async function bulkUpdatePrices(tenantId: string, input: BulkPriceUpdateInput) {
  await assertCategoryInTenant(tenantId, input.categoryId);

  const conditions = [eq(products.tenantId, tenantId), eq(products.isActive, true)];
  if (input.productIds && input.productIds.length > 0) conditions.push(inArray(products.id, input.productIds));
  else if (input.categoryId != null) conditions.push(eq(products.categoryId, input.categoryId));

  const targets = await db.select().from(products).where(and(...conditions));
  if (targets.length === 0) return { updated: [] };

  const applyAdjustment = (current: number) => {
    const next =
      input.adjustmentType === "percentage" ? current * (1 + input.adjustmentValue / 100) : current + input.adjustmentValue;
    return Math.max(0, roundMoney(next));
  };

  return db.transaction(async (tx) => {
    const updated = [];
    for (const product of targets) {
      const updateSale = input.priceField === "salePrice" || input.priceField === "both";
      const updatePurchase = input.priceField === "purchasePrice" || input.priceField === "both";

      const newSalePrice = updateSale ? applyAdjustment(Number(product.salePrice)) : Number(product.salePrice);
      const newPurchasePrice = updatePurchase ? applyAdjustment(Number(product.purchasePrice)) : Number(product.purchasePrice);

      const [row] = await tx
        .update(products)
        .set({
          salePrice: updateSale ? newSalePrice.toString() : undefined,
          purchasePrice: updatePurchase ? newPurchasePrice.toString() : undefined,
        })
        .where(and(eq(products.id, product.id), eq(products.tenantId, tenantId)))
        .returning();

      if (updateSale && newSalePrice.toString() !== product.salePrice) {
        await tx.insert(rateHistory).values({ productId: product.id, rate: newSalePrice.toString() });
      }

      updated.push({
        productId: product.id,
        name: product.name,
        oldSalePrice: product.salePrice,
        newSalePrice: row.salePrice,
        oldPurchasePrice: product.purchasePrice,
        newPurchasePrice: row.purchasePrice,
      });
    }
    return { updated };
  });
}

export async function getRateHistory(tenantId: string, productId: string) {
  await getProduct(tenantId, productId); // 404s if not in this tenant
  return db
    .select({ rate: rateHistory.rate, effectiveFrom: rateHistory.effectiveFrom })
    .from(rateHistory)
    .where(eq(rateHistory.productId, productId))
    .orderBy(rateHistory.effectiveFrom);
}

export async function setProductImage(tenantId: string, productId: string, imageUrl: string) {
  const [updated] = await db
    .update(products)
    .set({ imageUrl })
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .returning();
  if (!updated) throw new HttpError(404, "Product not found");
  return updated;
}
