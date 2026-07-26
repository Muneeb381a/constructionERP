import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { auditLog, invoices, ledgerEntries, stockMovements } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { adjustStock } from "../inventory/stock.service.js";
import { postLedgerEntry } from "../ledger/ledger.service.js";
import type { VoidInvoiceInput } from "./void.schema.js";

export type VoidInvoiceContext = {
  tenantId: string;
  userId: string;
};

export async function voidInvoice(ctx: VoidInvoiceContext, invoiceId: string, input: VoidInvoiceInput) {
  const { tenantId, userId } = ctx;

  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .for("update");
    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (invoice.status === "void") throw new HttpError(409, "Invoice is already void");

    // voiding an invoice that already has returns against it would double-reverse what
    // those returns already adjusted — void the returns first
    const [activeReturn] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.originalInvoiceId, invoice.id), eq(invoices.tenantId, tenantId), ne(invoices.status, "void")))
      .limit(1);
    if (activeReturn) {
      throw new HttpError(409, "Cannot void — this invoice has non-voided returns against it; void those first");
    }

    // reverse stock using the exact movements this invoice actually produced, rather than
    // recomputing unit conversions — avoids any chance of drifting from what really happened
    const movements = await tx.select().from(stockMovements).where(eq(stockMovements.referenceId, invoice.id));
    for (const movement of movements) {
      await adjustStock(tx, {
        tenantId,
        productId: movement.productId,
        warehouseId: movement.warehouseId,
        quantityChange: -Number(movement.quantityChange),
        reason: "void",
        referenceId: invoice.id,
      });
    }

    // reverse the ledger entry this invoice posted, if any (a walk-in cash sale has none)
    const [ledgerEntry] = await tx
      .select()
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.sourceType, "invoice"), eq(ledgerEntries.sourceId, invoice.id)))
      .limit(1);
    if (ledgerEntry) {
      await postLedgerEntry(tx, {
        tenantId,
        partyId: ledgerEntry.partyId,
        direction: ledgerEntry.direction === "debit" ? "credit" : "debit",
        amount: Number(ledgerEntry.amount),
        sourceType: "void",
        sourceId: invoice.id,
      });
    }

    const [voided] = await tx
      .update(invoices)
      .set({ status: "void", voidedAt: new Date(), voidedBy: userId })
      .where(eq(invoices.id, invoice.id))
      .returning();

    await tx.insert(auditLog).values({
      tenantId,
      userId,
      action: "invoice_void",
      entityType: "invoice",
      entityId: invoice.id,
      beforeData: JSON.stringify({ status: invoice.status, invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount }),
      afterData: JSON.stringify({ status: "void", reason: input.reason }),
    });

    return voided;
  });
}
