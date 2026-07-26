import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { branches } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateBranchInput, UpdateBranchInput } from "./branches.schema.js";

export function listBranches(tenantId: string) {
  return db.select().from(branches).where(eq(branches.tenantId, tenantId));
}

export async function createBranch(tenantId: string, input: CreateBranchInput) {
  const [branch] = await db
    .insert(branches)
    .values({ tenantId, name: input.name })
    .returning();
  return branch;
}

export async function updateBranch(tenantId: string, branchId: string, input: UpdateBranchInput) {
  const [updated] = await db
    .update(branches)
    .set(input)
    .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
    .returning();

  if (!updated) throw new HttpError(404, "Branch not found");
  return updated;
}
