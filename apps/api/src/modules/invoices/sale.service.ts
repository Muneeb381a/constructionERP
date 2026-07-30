import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { auditLog, invoiceItems, invoices, parties, payments, projects } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { adjustStock } from "../inventory/stock.service.js";
import { postLedgerEntry } from "../ledger/ledger.service.js";
import { generateInvoiceNumber } from "./invoiceNumber.service.js";
import { lockParty, resolveLineItems, roundMoney, validateBranchAndWarehouse } from "./shared.js";
import type { CreateSaleInvoiceInput } from "./sale.schema.js";

export type CreateSaleInvoiceContext = {
  tenantId: string;
  userId: string;
  role: string;
};

export async function createSaleInvoice(ctx: CreateSaleInvoiceContext, input: CreateSaleInvoiceInput) {
  const { tenantId, userId, role } = ctx;

  // idempotency: double-clicking "Save Invoice" must not create a duplicate
  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) {
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, existing.id));
    const [existingPayment] = await db.select().from(payments).where(eq(payments.invoiceId, existing.id)).limit(1);
    return { invoice: existing, items, payment: existingPayment ?? null, idempotentReplay: true };
  }

  return db.transaction(async (tx) => {
    await validateBranchAndWarehouse(tx, tenantId, input.branchId, input.warehouseId);

    // lock the party row for this transaction so two concurrent sales to the same
    // customer can't both read a stale balance and both slip past the credit check
    let party: typeof parties.$inferSelect | null = null;
    if (input.partyId) {
      party = await lockParty(tx, tenantId, input.partyId);
    }

    if (input.projectId) {
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.tenantId, tenantId)))
        .limit(1);
      if (!project) throw new HttpError(400, "projectId does not refer to a project in this tenant");
    }

    const { items: preparedItems, subtotal } = await resolveLineItems(tx, tenantId, input.items, "salePrice", input.partyId);

    const discount = input.discount ?? 0;
    if (discount > subtotal) throw new HttpError(400, "discount cannot exceed the invoice subtotal");
    const totalAmount = roundMoney(subtotal - discount);

    if (input.payment) {
      if (!party) throw new HttpError(400, "A customer must be selected to record a payment");
      if (input.payment.amount > totalAmount + 0.01) {
        throw new HttpError(400, "Amount received cannot exceed the invoice total");
      }
    }
    const amountReceived = input.payment?.amount ?? 0;

    let creditLimitOverridden = false;
    if (party) {
      const creditLimit = Number(party.creditLimit);
      if (creditLimit > 0) {
        // net effect on the running balance — an advance taken in the same breath as the
        // sale offsets it immediately, so it shouldn't count against the credit limit
        const projectedBalance = Number(party.cachedBalance) + totalAmount - amountReceived;
        if (projectedBalance > creditLimit) {
          if (role === "cashier") {
            throw new HttpError(409, "This sale would exceed the customer's credit limit");
          }
          if (!input.overrideCreditLimit) {
            throw new HttpError(
              409,
              "This sale would exceed the customer's credit limit — pass overrideCreditLimit to proceed (audit-logged)",
            );
          }
          creditLimitOverridden = true;
        }
      }
    }

    const invoiceNo = await generateInvoiceNumber(tx, { tenantId, branchId: input.branchId, documentType: "sale" });

    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId,
        branchId: input.branchId,
        type: "sale",
        status: "confirmed",
        invoiceNo,
        partyId: input.partyId ?? null,
        projectId: input.projectId ?? null,
        userId,
        subtotal: subtotal.toString(),
        discount: discount.toString(),
        totalAmount: totalAmount.toString(),
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    const insertedItems = [];
    for (const item of preparedItems) {
      const [row] = await tx
        .insert(invoiceItems)
        .values({
          invoiceId: invoice.id,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString(),
        })
        .returning();
      insertedItems.push(row);

      await adjustStock(tx, {
        tenantId,
        productId: item.productId,
        warehouseId: input.warehouseId,
        quantityChange: -item.baseQuantity,
        reason: "sale",
        referenceId: invoice.id,
      });
    }

    if (party) {
      await postLedgerEntry(tx, {
        tenantId,
        partyId: party.id,
        direction: "debit",
        amount: totalAmount,
        sourceType: "invoice",
        sourceId: invoice.id,
      });
    }

    let payment: typeof payments.$inferSelect | null = null;
    if (input.payment && party && amountReceived > 0) {
      [payment] = await tx
        .insert(payments)
        .values({
          tenantId,
          partyId: party.id,
          invoiceId: invoice.id,
          method: input.payment.method,
          amount: amountReceived.toString(),
          note: input.payment.note ?? null,
          idempotencyKey: randomUUID(),
        })
        .returning();

      await postLedgerEntry(tx, {
        tenantId,
        partyId: party.id,
        direction: "credit",
        amount: amountReceived,
        sourceType: "payment",
        sourceId: payment.id,
      });
    }

    if (creditLimitOverridden && party) {
      await tx.insert(auditLog).values({
        tenantId,
        userId,
        action: "credit_limit_override",
        entityType: "invoice",
        entityId: invoice.id,
        beforeData: JSON.stringify({
          partyId: party.id,
          creditLimit: party.creditLimit,
          balanceBefore: party.cachedBalance,
        }),
        afterData: JSON.stringify({ invoiceTotal: totalAmount }),
      });
    }

    return { invoice, items: insertedItems, payment, idempotentReplay: false };
  });
}
