import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { employees, invoiceItems, invoices } from "../../db/schema.js";
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
    db.select().from(invoices).where(where).orderBy(desc(invoices.createdAt)).limit(query.limit).offset(offset),
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
