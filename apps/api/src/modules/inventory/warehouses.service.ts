import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { branches, warehouses } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "./warehouses.schema.js";

export function listWarehouses(tenantId: string) {
  return db.select().from(warehouses).where(eq(warehouses.tenantId, tenantId));
}

export async function createWarehouse(tenantId: string, input: CreateWarehouseInput) {
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
    .limit(1);
  if (!branch) throw new HttpError(400, "branchId does not refer to a branch in this tenant");

  const [warehouse] = await db
    .insert(warehouses)
    .values({ tenantId, branchId: input.branchId, name: input.name })
    .returning();
  return warehouse;
}

export async function updateWarehouse(tenantId: string, warehouseId: string, input: UpdateWarehouseInput) {
  const [updated] = await db
    .update(warehouses)
    .set(input)
    .where(and(eq(warehouses.id, warehouseId), eq(warehouses.tenantId, tenantId)))
    .returning();

  if (!updated) throw new HttpError(404, "Warehouse not found");
  return updated;
}
