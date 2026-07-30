import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { invoices, products, projects, stockMovements, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateProjectInput } from "./projects.schema.js";

type EstimateLine = { productId: string; productName: string; targetQuantity: number; unitName: string };

export async function createProject(tenantId: string, userId: string, input: CreateProjectInput) {
  const [project] = await db
    .insert(projects)
    .values({
      tenantId,
      branchId: input.branchId,
      name: input.name,
      partyId: input.partyId ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      estimateSnapshot: input.estimateSnapshot ?? null,
      createdBy: userId,
    })
    .returning();
  return project;
}

export async function listProjects(tenantId: string, partyId?: string) {
  const conditions = [eq(projects.tenantId, tenantId)];
  if (partyId) conditions.push(eq(projects.partyId, partyId));
  return db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt));
}

export type ProjectProgressLine = {
  productId: string;
  productName: string;
  unitName: string;
  targetQuantity: number | null;
  suppliedQuantity: number;
};

/**
 * Sums stock_movements (already in base-unit quantities, same convention the Estimator's
 * snapshot uses) for every non-void invoice linked to this project, then lines that up
 * against the original estimate — so "60% of the cement has gone out" reads directly off
 * real sales, not a second manually-maintained total.
 */
export async function getProjectWithProgress(tenantId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  if (!project) throw new HttpError(404, "Project not found");

  const linkedInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.projectId, projectId), eq(invoices.tenantId, tenantId), ne(invoices.status, "void")))
    .orderBy(desc(invoices.createdAt));

  const invoiceIds = linkedInvoices.map((i) => i.id);
  const suppliedByProduct = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const movements = await db
      .select({ productId: stockMovements.productId, quantityChange: stockMovements.quantityChange })
      .from(stockMovements)
      .where(and(eq(stockMovements.reason, "sale"), inArray(stockMovements.referenceId, invoiceIds)));
    for (const m of movements) {
      const qty = -Number(m.quantityChange); // sale movements are recorded negative
      suppliedByProduct.set(m.productId, (suppliedByProduct.get(m.productId) ?? 0) + qty);
    }
  }

  const snapshot = ((project.estimateSnapshot as EstimateLine[] | null) ?? []).filter(
    (line): line is EstimateLine => !!line?.productId,
  );
  const snapshotProductIds = new Set(snapshot.map((l) => l.productId));

  const progress: ProjectProgressLine[] = snapshot.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    unitName: line.unitName,
    targetQuantity: line.targetQuantity,
    suppliedQuantity: suppliedByProduct.get(line.productId) ?? 0,
  }));

  // materials sold against this project that weren't part of the original estimate
  const extraProductIds = [...suppliedByProduct.keys()].filter((id) => !snapshotProductIds.has(id));
  if (extraProductIds.length > 0) {
    const extraProducts = await db
      .select({ id: products.id, name: products.name, unitName: units.name })
      .from(products)
      .innerJoin(units, eq(units.id, products.baseUnitId))
      .where(inArray(products.id, extraProductIds));
    for (const p of extraProducts) {
      progress.push({
        productId: p.id,
        productName: p.name,
        unitName: p.unitName,
        targetQuantity: null,
        suppliedQuantity: suppliedByProduct.get(p.id) ?? 0,
      });
    }
  }

  return { project, invoices: linkedInvoices, progress };
}

export async function updateProjectStatus(tenantId: string, projectId: string, status: "active" | "completed" | "on_hold") {
  const [updated] = await db
    .update(projects)
    .set({ status })
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .returning();
  if (!updated) throw new HttpError(404, "Project not found");
  return updated;
}
