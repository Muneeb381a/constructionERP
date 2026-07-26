import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { invoiceItems, invoices, productUnitConversions, products } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { adjustStock } from "../inventory/stock.service.js";
import { postLedgerEntry } from "../ledger/ledger.service.js";
import { generateInvoiceNumber } from "./invoiceNumber.service.js";
import { lockParty, roundMoney, roundQty, validateBranchAndWarehouse } from "./shared.js";
import type { CreateReturnInvoiceInput } from "./return.schema.js";

const EPSILON = 1e-6;

export type CreateReturnInvoiceContext = {
  tenantId: string;
  userId: string;
  role: string;
};

export async function createReturnInvoice(ctx: CreateReturnInvoiceContext, input: CreateReturnInvoiceInput) {
  const { tenantId, userId, role } = ctx;

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
    const [original] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, input.originalInvoiceId), eq(invoices.tenantId, tenantId)))
      .for("update");
    if (!original) throw new HttpError(400, "originalInvoiceId does not refer to an invoice in this tenant");
    if (original.type !== "sale" && original.type !== "purchase") {
      throw new HttpError(400, "Returns can only be created against a sale or purchase invoice");
    }
    if (original.status === "void") {
      throw new HttpError(409, "Cannot return against a voided invoice");
    }

    const returnType = original.type === "sale" ? "sale_return" : "purchase_return";
    if (returnType === "purchase_return" && role === "cashier") {
      throw new HttpError(403, "Only an owner or manager can process a purchase return");
    }

    await validateBranchAndWarehouse(tx, tenantId, input.branchId, input.warehouseId);

    const party = original.partyId ? await lockParty(tx, tenantId, original.partyId) : null;

    const originalItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, original.id));

    // sum up everything already returned against this invoice (excluding voided returns)
    // so a partial return can't be repeated past what was actually sold/purchased
    const priorReturnInvoices = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.originalInvoiceId, original.id), eq(invoices.tenantId, tenantId), ne(invoices.status, "void")));

    const priorReturnItems = priorReturnInvoices.length
      ? await tx.select().from(invoiceItems).where(
          inArray(
            invoiceItems.invoiceId,
            priorReturnInvoices.map((r) => r.id),
          ),
        )
      : [];

    const preparedItems: {
      productId: string;
      unitId: number;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      baseQuantity: number;
    }[] = [];

    for (const item of input.items) {
      const originalLine = originalItems.find((oi) => oi.productId === item.productId && oi.unitId === item.unitId);
      if (!originalLine) {
        throw new HttpError(400, `Product ${item.productId} in that unit was not part of the original invoice`);
      }

      const alreadyReturned = priorReturnItems
        .filter((ri) => ri.productId === item.productId && ri.unitId === item.unitId)
        .reduce((sum, ri) => sum + Number(ri.quantity), 0);

      const availableToReturn = Number(originalLine.quantity) - alreadyReturned;
      if (item.quantity > availableToReturn + EPSILON) {
        throw new HttpError(
          400,
          `Cannot return ${item.quantity} — only ${roundQty(availableToReturn)} left returnable for this product on this invoice`,
        );
      }

      // reversed at the ORIGINAL invoice's rate — never the current product price
      const unitPrice = Number(originalLine.unitPrice);
      const lineTotal = roundMoney(item.quantity * unitPrice);

      const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      let factor = 1;
      if (item.unitId !== product!.baseUnitId) {
        const [conversion] = await tx
          .select()
          .from(productUnitConversions)
          .where(and(eq(productUnitConversions.productId, item.productId), eq(productUnitConversions.fromUnitId, item.unitId)))
          .limit(1);
        // guaranteed to exist — the original sale/purchase couldn't have used this unit without it
        factor = Number(conversion!.toBaseUnitFactor);
      }
      const baseQuantity = roundQty(item.quantity * factor);

      preparedItems.push({ productId: item.productId, unitId: item.unitId, quantity: item.quantity, unitPrice, lineTotal, baseQuantity });
    }

    const subtotal = roundMoney(preparedItems.reduce((sum, i) => sum + i.lineTotal, 0));

    const invoiceNo = await generateInvoiceNumber(tx, { tenantId, branchId: input.branchId, documentType: returnType });

    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId,
        branchId: input.branchId,
        type: returnType,
        status: "confirmed",
        invoiceNo,
        partyId: original.partyId,
        userId,
        originalInvoiceId: original.id,
        subtotal: subtotal.toString(),
        discount: "0",
        totalAmount: subtotal.toString(),
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

      // sale_return puts stock back; purchase_return sends it back out
      const stockDelta = returnType === "sale_return" ? item.baseQuantity : -item.baseQuantity;
      await adjustStock(tx, {
        tenantId,
        productId: item.productId,
        warehouseId: input.warehouseId,
        quantityChange: stockDelta,
        reason: returnType,
        referenceId: invoice.id,
      });
    }

    if (party) {
      // both return types reduce the outstanding balance in the relationship: less owed
      // to us (sale_return) or less owed by us (purchase_return) — always "credit" here
      await postLedgerEntry(tx, {
        tenantId,
        partyId: party.id,
        direction: "credit",
        amount: subtotal,
        sourceType: "invoice",
        sourceId: invoice.id,
      });
    }

    return { invoice, items: insertedItems, idempotentReplay: false };
  });
}
