import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { categories, productStock, products, stockMovements, tenants, units, warehouses } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

export type { DbOrTx };
export type StockMovementReason =
  | "sale"
  | "purchase"
  | "sale_return"
  | "purchase_return"
  | "transfer"
  | "adjustment"
  | "void";

export type AdjustStockParams = {
  tenantId: string;
  productId: string;
  warehouseId: string;
  quantityChange: number; // positive to add stock, negative to deduct
  reason: StockMovementReason;
  referenceId?: string | null;
};

/**
 * Locks the (product, warehouse) stock row for the duration of the caller's transaction,
 * checks the negative-stock policy, applies the change, and logs a stock_movements row.
 * Callers pass their own `tx` so this can participate in a larger atomic transaction
 * (e.g. sale invoice: lock stock -> deduct -> insert invoice/items -> post ledger entry).
 */
export async function adjustStock(executor: DbOrTx, params: AdjustStockParams) {
  const { tenantId, productId, warehouseId, quantityChange, reason, referenceId } = params;
  if (quantityChange === 0) throw new HttpError(400, "quantityChange must not be zero");

  const [warehouse] = await executor
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.id, warehouseId), eq(warehouses.tenantId, tenantId)))
    .limit(1);
  if (!warehouse) throw new HttpError(400, "warehouseId does not refer to a warehouse in this tenant");

  const [product] = await executor
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .limit(1);
  if (!product) throw new HttpError(400, "productId does not refer to a product in this tenant");

  let [stockRow] = await executor
    .select()
    .from(productStock)
    .where(and(eq(productStock.productId, productId), eq(productStock.warehouseId, warehouseId)))
    .for("update");

  if (!stockRow) {
    [stockRow] = await executor
      .insert(productStock)
      .values({ productId, warehouseId, quantity: "0" })
      .onConflictDoNothing({ target: [productStock.productId, productStock.warehouseId] })
      .returning();

    if (!stockRow) {
      // lost the race to another concurrent adjustStock call — re-select and lock the row it created
      [stockRow] = await executor
        .select()
        .from(productStock)
        .where(and(eq(productStock.productId, productId), eq(productStock.warehouseId, warehouseId)))
        .for("update");
    }
  }

  const projected = Number(stockRow.quantity) + quantityChange;
  if (projected < 0) {
    const [tenant] = await executor
      .select({ allowNegativeStock: tenants.allowNegativeStock })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant?.allowNegativeStock) {
      throw new HttpError(409, "Insufficient stock in this warehouse and negative stock is not allowed for this tenant");
    }
  }

  const [updated] = await executor
    .update(productStock)
    .set({
      quantity: sql`${productStock.quantity} + ${quantityChange}`,
      version: sql`${productStock.version} + 1`,
    })
    .where(eq(productStock.id, stockRow.id))
    .returning();

  await executor.insert(stockMovements).values({
    productId,
    warehouseId,
    quantityChange: quantityChange.toString(),
    reason,
    referenceId: referenceId ?? null,
  });

  return updated;
}

export function listStockForProduct(tenantId: string, productId: string) {
  return db
    .select({
      id: productStock.id,
      productId: productStock.productId,
      warehouseId: productStock.warehouseId,
      warehouseName: warehouses.name,
      quantity: productStock.quantity,
      version: productStock.version,
    })
    .from(productStock)
    .innerJoin(warehouses, eq(warehouses.id, productStock.warehouseId))
    .where(and(eq(productStock.productId, productId), eq(warehouses.tenantId, tenantId)));
}

export function listStockForWarehouse(tenantId: string, warehouseId: string) {
  return db
    .select({
      id: productStock.id,
      productId: productStock.productId,
      productName: products.name,
      warehouseId: productStock.warehouseId,
      quantity: productStock.quantity,
      version: productStock.version,
      categoryId: products.categoryId,
      categoryName: categories.name,
      unitId: products.baseUnitId,
      unitName: units.name,
      minStock: products.minStock,
      maxStock: products.maxStock,
    })
    .from(productStock)
    .innerJoin(products, eq(products.id, productStock.productId))
    .innerJoin(units, eq(units.id, products.baseUnitId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(productStock.warehouseId, warehouseId), eq(products.tenantId, tenantId)));
}

export function listMovementsForProduct(tenantId: string, productId: string) {
  return db
    .select({
      id: stockMovements.id,
      warehouseId: stockMovements.warehouseId,
      quantityChange: stockMovements.quantityChange,
      reason: stockMovements.reason,
      referenceId: stockMovements.referenceId,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(eq(stockMovements.productId, productId), eq(products.tenantId, tenantId)))
    .orderBy(stockMovements.createdAt);
}
