import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { branches, parties, products, quotationItems, quotations, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { resolveLineItems } from "../invoices/shared.js";
import { generateInvoiceNumber } from "../invoices/invoiceNumber.service.js";
import { createSaleInvoice } from "../invoices/sale.service.js";
import { lockParty } from "../parties/parties.service.js";
import type { CreateQuotationInput, ListQuotationsQuery } from "./quotations.schema.js";

export type QuotationContext = {
  tenantId: string;
  userId: string;
  role: string;
};

export async function createQuotation(ctx: QuotationContext, input: CreateQuotationInput) {
  const { tenantId, userId } = ctx;

  return db.transaction(async (tx) => {
    const [branch] = await tx
      .select()
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
      .limit(1);
    if (!branch) throw new HttpError(400, "branchId does not refer to a branch in this tenant");

    if (input.partyId) await lockParty(tx, tenantId, input.partyId);

    // quoted prices always come from the current sale price by default — same rule as a sale
    const { items: preparedItems, subtotal } = await resolveLineItems(tx, tenantId, input.items, "salePrice");

    const discount = input.discount ?? 0;
    if (discount > subtotal) throw new HttpError(400, "discount cannot exceed the quotation subtotal");
    const totalAmount = subtotal - discount;

    const quotationNo = await generateInvoiceNumber(tx, { tenantId, branchId: input.branchId, documentType: "quotation" });

    const [quotation] = await tx
      .insert(quotations)
      .values({
        tenantId,
        branchId: input.branchId,
        quotationNo,
        partyId: input.partyId ?? null,
        userId,
        status: "draft",
        subtotal: subtotal.toString(),
        discount: discount.toString(),
        totalAmount: totalAmount.toString(),
        validUntil: input.validUntil ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    const insertedItems = [];
    for (const item of preparedItems) {
      const [row] = await tx
        .insert(quotationItems)
        .values({
          quotationId: quotation.id,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString(),
        })
        .returning();
      insertedItems.push(row);
    }

    return { quotation, items: insertedItems };
  });
}

export async function listQuotations(tenantId: string, query: ListQuotationsQuery) {
  const conditions = [eq(quotations.tenantId, tenantId)];
  if (query.status) conditions.push(eq(quotations.status, query.status));
  if (query.partyId) conditions.push(eq(quotations.partyId, query.partyId));

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: quotations.id,
        tenantId: quotations.tenantId,
        branchId: quotations.branchId,
        quotationNo: quotations.quotationNo,
        partyId: quotations.partyId,
        partyName: parties.name,
        userId: quotations.userId,
        status: quotations.status,
        subtotal: quotations.subtotal,
        discount: quotations.discount,
        totalAmount: quotations.totalAmount,
        validUntil: quotations.validUntil,
        notes: quotations.notes,
        convertedInvoiceId: quotations.convertedInvoiceId,
        createdAt: quotations.createdAt,
      })
      .from(quotations)
      .leftJoin(parties, eq(parties.id, quotations.partyId))
      .where(where)
      .orderBy(desc(quotations.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(quotations).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}

export async function getQuotation(tenantId: string, quotationId: string) {
  const [quotation] = await db
    .select()
    .from(quotations)
    .where(and(eq(quotations.id, quotationId), eq(quotations.tenantId, tenantId)))
    .limit(1);
  if (!quotation) throw new HttpError(404, "Quotation not found");

  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, quotation.id));
  return { quotation, items };
}

export async function updateQuotationStatus(
  tenantId: string,
  quotationId: string,
  status: "sent" | "accepted" | "rejected" | "expired",
) {
  const { quotation } = await getQuotation(tenantId, quotationId);
  if (quotation.status === "converted") {
    throw new HttpError(409, "This quotation has already been converted to an invoice and can't change status");
  }

  const [updated] = await db
    .update(quotations)
    .set({ status })
    .where(and(eq(quotations.id, quotationId), eq(quotations.tenantId, tenantId)))
    .returning();
  return updated;
}

/**
 * Converts an accepted quotation into a real sale invoice by calling the SAME
 * createSaleInvoice() the Sale screen uses — so stock locking, the credit-limit
 * gate, and ledger posting all apply exactly as they would for a normal sale.
 * Prices are taken from the quotation's own snapshot, not the product's current
 * rate, so the customer is honored the price they were quoted.
 */
export async function convertToInvoice(
  ctx: QuotationContext,
  quotationId: string,
  input: { warehouseId: string; overrideCreditLimit?: boolean },
) {
  const { quotation, items } = await getQuotation(ctx.tenantId, quotationId);

  if (quotation.status === "converted") {
    throw new HttpError(409, "This quotation has already been converted to an invoice");
  }
  if (quotation.status === "rejected" || quotation.status === "expired") {
    throw new HttpError(409, `Cannot convert a ${quotation.status} quotation`);
  }

  const result = await createSaleInvoice(ctx, {
    idempotencyKey: randomUUID(),
    branchId: quotation.branchId,
    warehouseId: input.warehouseId,
    partyId: quotation.partyId,
    discount: quotation.discount ? Number(quotation.discount) : undefined,
    overrideCreditLimit: input.overrideCreditLimit,
    items: items.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  });

  await db
    .update(quotations)
    .set({ status: "converted", convertedInvoiceId: result.invoice.id })
    .where(eq(quotations.id, quotationId));

  return result;
}

/** Lazily creates and returns a quotation's public accept-link token — same token every
 * time once generated, so the link a shop shares over WhatsApp stays valid. */
export async function getOrCreateQuotationPublicToken(tenantId: string, quotationId: string) {
  const { quotation } = await getQuotation(tenantId, quotationId);
  if (quotation.publicToken) return quotation.publicToken;

  const [updated] = await db
    .update(quotations)
    .set({ publicToken: sql`gen_random_uuid()` })
    .where(and(eq(quotations.id, quotationId), eq(quotations.tenantId, tenantId)))
    .returning({ publicToken: quotations.publicToken });
  return updated.publicToken!;
}

/** No-login view for a customer following a shared quotation link — a narrow, safe slice
 * (itemized quote + status), nothing else about the tenant or its catalog. */
export async function getPublicQuotationByToken(token: string) {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.publicToken, token)).limit(1);
  if (!quotation) throw new HttpError(404, "Invalid or expired link");

  const items = await db
    .select({
      productName: products.name,
      unitName: units.name,
      quantity: quotationItems.quantity,
      unitPrice: quotationItems.unitPrice,
      lineTotal: quotationItems.lineTotal,
    })
    .from(quotationItems)
    .innerJoin(products, eq(products.id, quotationItems.productId))
    .innerJoin(units, eq(units.id, quotationItems.unitId))
    .where(eq(quotationItems.quotationId, quotation.id));

  return {
    quotationNo: quotation.quotationNo,
    status: quotation.status,
    validUntil: quotation.validUntil,
    notes: quotation.notes,
    subtotal: quotation.subtotal,
    discount: quotation.discount,
    totalAmount: quotation.totalAmount,
    items,
  };
}

/** The customer's own "Accept" tap on the public link — same status transition an owner/
 * manager/cashier could make internally, just triggered without a login via the token. */
export async function acceptPublicQuotation(token: string) {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.publicToken, token)).limit(1);
  if (!quotation) throw new HttpError(404, "Invalid or expired link");

  if (quotation.status === "accepted") return { status: "accepted" as const };
  if (quotation.status !== "draft" && quotation.status !== "sent") {
    throw new HttpError(409, `This quotation is ${quotation.status} and can no longer be accepted`);
  }

  const updated = await updateQuotationStatus(quotation.tenantId, quotation.id, "accepted");
  return { status: updated.status };
}
