import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../../db/index.js";
import { branches, productUnitConversions, products, warehouses } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { lockParty } from "../parties/parties.service.js";
import { getActiveRateLockPrice } from "../rateLocks/rateLocks.service.js";

export { lockParty };

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function roundQty(n: number) {
  return Math.round(n * 1000) / 1000;
}

export type LineItemInput = {
  productId: string;
  unitId: number;
  quantity: number;
  unitPrice?: number;
};

export type PreparedLineItem = {
  productId: string;
  unitId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  baseQuantity: number;
};

/**
 * Resolves each line's unit conversion to base unit and snapshots its price — shared by
 * sale, purchase, and returns so the "never re-derive from products.* later" rule and the
 * "explicit price required off the base unit" rule can't drift between the three flows.
 */
export async function resolveLineItems(
  tx: DbOrTx,
  tenantId: string,
  items: LineItemInput[],
  priceField: "salePrice" | "purchasePrice",
  partyId?: string | null,
): Promise<{ items: PreparedLineItem[]; subtotal: number }> {
  const prepared: PreparedLineItem[] = [];

  for (const item of items) {
    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, item.productId), eq(products.tenantId, tenantId)))
      .limit(1);
    if (!product) throw new HttpError(400, `productId ${item.productId} does not refer to a product in this tenant`);
    if (!product.isActive) throw new HttpError(400, `Product "${product.name}" is deactivated`);

    let factor = 1;
    if (item.unitId !== product.baseUnitId) {
      const [conversion] = await tx
        .select()
        .from(productUnitConversions)
        .where(
          and(eq(productUnitConversions.productId, item.productId), eq(productUnitConversions.fromUnitId, item.unitId)),
        )
        .limit(1);
      if (!conversion) {
        throw new HttpError(400, `No unit conversion defined for product "${product.name}" in the requested unit`);
      }
      factor = Number(conversion.toBaseUnitFactor);
    }

    // product.salePrice/purchasePrice is quoted in the base unit, so it can only be
    // defaulted when transacting in that same unit — otherwise a Ton-priced rate would
    // silently get charged per KG.
    if (item.unitPrice == null && item.unitId !== product.baseUnitId) {
      throw new HttpError(
        400,
        `An explicit unitPrice is required for product "${product.name}" when using a unit other than its base unit`,
      );
    }
    // A rate lock only ever substitutes the DEFAULT (product.salePrice) — an explicit
    // unitPrice from the client (a cashier's own override) still wins over it.
    let fallbackPrice = Number(product[priceField]);
    if (priceField === "salePrice" && partyId && item.unitId === product.baseUnitId) {
      const lockedPrice = await getActiveRateLockPrice(tx, tenantId, partyId, item.productId);
      if (lockedPrice != null) fallbackPrice = lockedPrice;
    }

    // unitPrice is snapshotted here and only here — never re-derived from products.* later
    const unitPrice = item.unitPrice ?? fallbackPrice;
    const lineTotal = roundMoney(item.quantity * unitPrice);
    const baseQuantity = roundQty(item.quantity * factor);

    prepared.push({ productId: item.productId, unitId: item.unitId, quantity: item.quantity, unitPrice, lineTotal, baseQuantity });
  }

  const subtotal = roundMoney(prepared.reduce((sum, i) => sum + i.lineTotal, 0));
  return { items: prepared, subtotal };
}

export async function validateBranchAndWarehouse(tx: DbOrTx, tenantId: string, branchId: string, warehouseId: string) {
  const [branch] = await tx
    .select()
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!branch) throw new HttpError(400, "branchId does not refer to a branch in this tenant");

  const [warehouse] = await tx
    .select()
    .from(warehouses)
    .where(and(eq(warehouses.id, warehouseId), eq(warehouses.tenantId, tenantId)))
    .limit(1);
  if (!warehouse) throw new HttpError(400, "warehouseId does not refer to a warehouse in this tenant");
}
