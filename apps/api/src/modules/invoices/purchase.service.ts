import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { invoiceItems, invoices } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { adjustStock } from "../inventory/stock.service.js";
import { postLedgerEntry } from "../ledger/ledger.service.js";
import { generateInvoiceNumber } from "./invoiceNumber.service.js";
import { lockParty, resolveLineItems, roundMoney, validateBranchAndWarehouse } from "./shared.js";
import type { CreatePurchaseInvoiceInput } from "./purchase.schema.js";

export type CreatePurchaseInvoiceContext = {
  tenantId: string;
  userId: string;
};

export async function createPurchaseInvoice(ctx: CreatePurchaseInvoiceContext, input: CreatePurchaseInvoiceInput) {
  const { tenantId, userId } = ctx;

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) {
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, existing.id));
    return { invoice: existing, items, idempotentReplay: true };
  }

  return db.transaction(async (tx) => {
    await validateBranchAndWarehouse(tx, tenantId, input.branchId, input.warehouseId);

    // no credit-limit check here — that guard protects the business from customer bad
    // debt on sales, it has no equivalent on the purchase side
    const party = input.partyId ? await lockParty(tx, tenantId, input.partyId) : null;

    const { items: preparedItems, subtotal } = await resolveLineItems(tx, tenantId, input.items, "purchasePrice");

    const discount = input.discount ?? 0;
    if (discount > subtotal) throw new HttpError(400, "discount cannot exceed the invoice subtotal");
    const otherChargesTotal = (input.otherCharges ?? []).reduce((sum, c) => sum + c.amount, 0);
    const totalAmount = roundMoney(subtotal - discount + otherChargesTotal);

    const invoiceNo = await generateInvoiceNumber(tx, { tenantId, branchId: input.branchId, documentType: "purchase" });

    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId,
        branchId: input.branchId,
        type: "purchase",
        status: "confirmed",
        invoiceNo,
        partyId: input.partyId ?? null,
        userId,
        subtotal: subtotal.toString(),
        discount: discount.toString(),
        otherCharges: input.otherCharges?.length ? input.otherCharges : null,
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
        quantityChange: item.baseQuantity, // purchase adds stock instead of deducting it
        reason: "purchase",
        referenceId: invoice.id,
      });
    }

    if (party) {
      // "debit" is used consistently as "increases the balance outstanding in this party
      // relationship" — for a customer that's what they owe us, for a supplier it's what
      // we owe them. Which one it means is determined by parties.type, not by direction.
      await postLedgerEntry(tx, {
        tenantId,
        partyId: party.id,
        direction: "debit",
        amount: totalAmount,
        sourceType: "invoice",
        sourceId: invoice.id,
      });
    }

    return { invoice, items: insertedItems, idempotentReplay: false };
  });
}
