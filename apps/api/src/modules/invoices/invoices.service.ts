import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { employees, invoiceItems, invoices, parties, products, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { AssignDeliveryInput, ListInvoicesQuery } from "./invoices.schema.js";

export async function listInvoices(tenantId: string, query: ListInvoicesQuery) {
  const conditions = [eq(invoices.tenantId, tenantId)];
  if (query.type) conditions.push(eq(invoices.type, query.type));
  if (query.partyId) conditions.push(eq(invoices.partyId, query.partyId));
  if (query.dateFrom) conditions.push(gte(invoices.createdAt, query.dateFrom));
  if (query.dateTo) conditions.push(lte(invoices.createdAt, query.dateTo));

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        branchId: invoices.branchId,
        type: invoices.type,
        status: invoices.status,
        invoiceNo: invoices.invoiceNo,
        partyId: invoices.partyId,
        partyName: parties.name,
        userId: invoices.userId,
        originalInvoiceId: invoices.originalInvoiceId,
        subtotal: invoices.subtotal,
        discount: invoices.discount,
        totalAmount: invoices.totalAmount,
        idempotencyKey: invoices.idempotencyKey,
        voidedAt: invoices.voidedAt,
        voidedBy: invoices.voidedBy,
        deliveryEmployeeId: invoices.deliveryEmployeeId,
        deliveryStatus: invoices.deliveryStatus,
        deliveredAt: invoices.deliveredAt,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .leftJoin(parties, eq(parties.id, invoices.partyId))
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}

export async function getInvoice(tenantId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!invoice) throw new HttpError(404, "Invoice not found");

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
  return { invoice, items };
}

/** Assigns (or reassigns) a driver/loader to an invoice and sets it pending — a void invoice can't be assigned. */
export async function assignDelivery(tenantId: string, invoiceId: string, input: AssignDeliveryInput) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (invoice.status === "void") throw new HttpError(409, "Cannot assign delivery on a voided invoice");

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);
  if (!employee) throw new HttpError(400, "employeeId does not refer to an employee in this tenant");

  const [updated] = await db
    .update(invoices)
    .set({ deliveryEmployeeId: input.employeeId, deliveryStatus: "pending", deliveredAt: null })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .returning();
  return updated;
}

export async function markDelivered(tenantId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (!invoice.deliveryEmployeeId) throw new HttpError(400, "Assign a delivery employee before marking it delivered");

  const [updated] = await db
    .update(invoices)
    .set({ deliveryStatus: "delivered", deliveredAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .returning();
  return updated;
}

/** Lazily creates and returns an invoice's public order-tracking token — same token every
 * time once generated, so the link a shop shares over WhatsApp stays valid. */
export async function getOrCreateInvoicePublicToken(tenantId: string, invoiceId: string) {
  const { invoice } = await getInvoice(tenantId, invoiceId);
  if (invoice.publicToken) return invoice.publicToken;

  const [updated] = await db
    .update(invoices)
    .set({ publicToken: sql`gen_random_uuid()` })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .returning({ publicToken: invoices.publicToken });
  return updated.publicToken!;
}

/** No-login view for a customer following a shared order-tracking link — status + items,
 * nothing about pricing internals or the tenant's wider catalog. */
export async function getPublicTrackingByToken(token: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.publicToken, token)).limit(1);
  if (!invoice) throw new HttpError(404, "Invalid or expired link");

  const [driver] = invoice.deliveryEmployeeId
    ? await db.select({ name: employees.name, phone: employees.phone }).from(employees).where(eq(employees.id, invoice.deliveryEmployeeId)).limit(1)
    : [null];

  const items = await db
    .select({ productName: products.name, unitName: units.name, quantity: invoiceItems.quantity })
    .from(invoiceItems)
    .innerJoin(products, eq(products.id, invoiceItems.productId))
    .innerJoin(units, eq(units.id, invoiceItems.unitId))
    .where(eq(invoiceItems.invoiceId, invoice.id));

  return {
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    deliveryStatus: invoice.deliveryStatus,
    createdAt: invoice.createdAt,
    deliveredAt: invoice.deliveredAt,
    totalAmount: invoice.totalAmount,
    driverName: driver?.name ?? null,
    driverPhone: driver?.phone ?? null,
    items,
  };
}
