import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { categories } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { pgErrorCode } from "../../lib/pgError.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema.js";

async function assertParentInTenant(tenantId: string, parentId: number | null | undefined) {
  if (parentId == null) return;
  const [parent] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, parentId), eq(categories.tenantId, tenantId)))
    .limit(1);
  if (!parent) throw new HttpError(400, "parentId does not refer to a category in this tenant");
}

export function listCategories(tenantId: string) {
  return db.select().from(categories).where(eq(categories.tenantId, tenantId));
}

export async function createCategory(tenantId: string, input: CreateCategoryInput) {
  await assertParentInTenant(tenantId, input.parentId);

  const [category] = await db
    .insert(categories)
    .values({
      tenantId,
      name: input.name,
      nameUrdu: input.nameUrdu ?? null,
      parentId: input.parentId ?? null,
    })
    .returning();

  return category;
}

export async function updateCategory(tenantId: string, categoryId: number, input: UpdateCategoryInput) {
  await assertParentInTenant(tenantId, input.parentId);

  const [updated] = await db
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)))
    .returning();

  if (!updated) throw new HttpError(404, "Category not found");
  return updated;
}

export async function deleteCategory(tenantId: string, categoryId: number) {
  // parentId has no DB-level FK (matches the blueprint schema), so orphaned children
  // must be caught here rather than relying on a foreign key violation.
  const [child] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.parentId, categoryId)))
    .limit(1);
  if (child) {
    throw new HttpError(409, "Category still has subcategories — reassign or delete them first");
  }

  try {
    const [deleted] = await db
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)))
      .returning({ id: categories.id });

    if (!deleted) throw new HttpError(404, "Category not found");
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (pgErrorCode(err) === "23503") {
      throw new HttpError(409, "Category is still in use by products or subcategories — deactivate or reassign them first");
    }
    throw err;
  }
}
