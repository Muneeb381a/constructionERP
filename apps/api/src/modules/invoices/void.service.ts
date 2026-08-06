import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { auditLog, cheques, invoices, ledgerEntries, payments, stockMovements } from "../../db/schema.js";
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

    // Any payment recorded specifically against this bill (walk-in cash paid at sale time,
    // or a later part-payment) also needs its ledger effect undone — otherwise voiding only
    // reverses the invoice's own entry and silently shorts the party's balance by whatever
    // was paid, while the payment row is left pointing at a dead invoice. A cheque payment
    // still sitting "pending" is the one case we can't safely auto-reverse here: its credit
    // was already posted at payment time, and if it later clears or bounces that handler
    // would act on the same credit again, double-counting the correction. Block only that
    // case and ask for the cheque to be resolved first; everything else reverses automatically.
    const linkedPayments = await tx.select().from(payments).where(eq(payments.invoiceId, invoice.id));
    const linkedCheques = linkedPayments.length
      ? await tx
          .select()
          .from(cheques)
          .where(
            inArray(
              cheques.paymentId,
              linkedPayments.map((p) => p.id),
            ),
          )
      : [];
    const chequeByPaymentId = new Map(linkedCheques.map((c) => [c.paymentId, c]));

    if (linkedPayments.some((p) => chequeByPaymentId.get(p.id)?.status === "pending")) {
      throw new HttpError(
        409,
        "Cannot void — this invoice has a payment via a still-pending cheque; clear or mark it bounced first",
      );
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

    // Reverse each linked payment's own ledger entry too (see the guard above). A bounced
    // cheque's credit was already neutralized by cheque_bounce's own reversal — reversing it
    // again here would double it, so those are skipped.
    for (const payment of linkedPayments) {
      if (chequeByPaymentId.get(payment.id)?.status === "bounced") continue;

      const [paymentLedgerEntry] = await tx
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.sourceType, "payment"), eq(ledgerEntries.sourceId, payment.id)))
        .limit(1);
      if (paymentLedgerEntry) {
        await postLedgerEntry(tx, {
          tenantId,
          partyId: paymentLedgerEntry.partyId,
          direction: paymentLedgerEntry.direction === "debit" ? "credit" : "debit",
          amount: Number(paymentLedgerEntry.amount),
          sourceType: "void",
          sourceId: payment.id,
        });
      }
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
