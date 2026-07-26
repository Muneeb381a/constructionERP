import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stockTransfers } from "../../db/schema.js";
import { adjustStock } from "./stock.service.js";
import type { CreateTransferInput } from "./stock.schema.js";

export type CreateTransferContext = {
  tenantId: string;
  userId: string;
};

/**
 * Moves stock between two warehouses of the same tenant as one atomic operation: a paired
 * -qty/+qty adjustStock call sharing a single reference, so it can never partially apply.
 */
export async function createTransfer(ctx: CreateTransferContext, input: CreateTransferInput) {
  const { tenantId, userId } = ctx;

  const [existing] = await db
    .select()
    .from(stockTransfers)
    .where(and(eq(stockTransfers.tenantId, tenantId), eq(stockTransfers.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) return { transfer: existing, idempotentReplay: true };

  return db.transaction(async (tx) => {
    const [transfer] = await tx
      .insert(stockTransfers)
      .values({
        tenantId,
        productId: input.productId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        quantity: input.quantity.toString(),
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
        createdBy: userId,
      })
      .returning();

    await adjustStock(tx, {
      tenantId,
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      quantityChange: -input.quantity,
      reason: "transfer",
      referenceId: transfer.id,
    });

    await adjustStock(tx, {
      tenantId,
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      quantityChange: input.quantity,
      reason: "transfer",
      referenceId: transfer.id,
    });

    return { transfer, idempotentReplay: false };
  });
}

export function listTransfers(tenantId: string, params: { productId?: string; warehouseId?: string } = {}) {
  const conditions = [eq(stockTransfers.tenantId, tenantId)];
  if (params.productId) conditions.push(eq(stockTransfers.productId, params.productId));
  if (params.warehouseId) {
    conditions.push(or(eq(stockTransfers.fromWarehouseId, params.warehouseId), eq(stockTransfers.toWarehouseId, params.warehouseId))!);
  }

  return db
    .select()
    .from(stockTransfers)
    .where(and(...conditions))
    .orderBy(desc(stockTransfers.createdAt));
}
