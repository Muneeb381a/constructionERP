import { and, asc, desc, eq, inArray, lte, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { cheques, invoices, parties, payments } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { lockParty } from "../parties/parties.service.js";
import { postLedgerEntry } from "../ledger/ledger.service.js";
import type { CreatePaymentInput } from "./payments.schema.js";

export type CreatePaymentContext = {
  tenantId: string;
};

export async function createPayment(ctx: CreatePaymentContext, input: CreatePaymentInput) {
  const { tenantId } = ctx;

  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existingPayment) {
    const [existingCheque] = await db.select().from(cheques).where(eq(cheques.paymentId, existingPayment.id)).limit(1);
    return { payment: existingPayment, cheque: existingCheque ?? null, idempotentReplay: true };
  }

  return db.transaction(async (tx) => {
    await lockParty(tx, tenantId, input.partyId);

    if (input.invoiceId) {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, tenantId)))
        .limit(1);
      if (!invoice) throw new HttpError(404, "Invoice not found");
      if (invoice.partyId !== input.partyId) throw new HttpError(400, "Invoice does not belong to this party");
      if (invoice.status === "void") throw new HttpError(409, "Cannot record a payment against a voided invoice");
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        tenantId,
        partyId: input.partyId,
        invoiceId: input.invoiceId ?? null,
        method: input.method,
        amount: input.amount.toString(),
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    let cheque = null;
    if (input.method === "cheque" && input.cheque) {
      [cheque] = await tx
        .insert(cheques)
        .values({
          paymentId: payment.id,
          chequeNo: input.cheque.chequeNo,
          bankName: input.cheque.bankName ?? null,
          dueDate: input.cheque.dueDate,
          status: "pending",
        })
        .returning();
    }

    // recorded immediately (even for a pending cheque) — a bounce later reverses this
    // with its own debit entry rather than un-recording the original payment attempt
    await postLedgerEntry(tx, {
      tenantId,
      partyId: input.partyId,
      direction: "credit",
      amount: input.amount,
      sourceType: "payment",
      sourceId: payment.id,
    });

    return { payment, cheque, idempotentReplay: false };
  });
}

export async function listPaymentsForParty(tenantId: string, partyId: string) {
  const rows = await db
    .select({ payment: payments, cheque: cheques, invoiceNo: invoices.invoiceNo })
    .from(payments)
    .leftJoin(cheques, eq(cheques.paymentId, payments.id))
    .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(payments.tenantId, tenantId), eq(payments.partyId, partyId)))
    .orderBy(desc(payments.createdAt));

  return rows.map((row) => ({ ...row.payment, cheque: row.cheque ?? null, invoiceNo: row.invoiceNo ?? null }));
}

export type PartyBill = {
  invoice: typeof invoices.$inferSelect;
  returnsTotal: number;
  netAmount: number;
  paidTotal: number;
  balanceDue: number;
  status: "paid" | "partial" | "unpaid" | "void";
};

/**
 * A "bill" is an original sale/purchase invoice; returns filed against it (via
 * originalInvoiceId) and payments linked to it (via payments.invoiceId) net out
 * to the true amount still owed on that specific bill — not just the party's
 * overall running balance.
 */
export async function listBillsForParty(tenantId: string, partyId: string): Promise<PartyBill[]> {
  const billInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.partyId, partyId), inArray(invoices.type, ["sale", "purchase"])))
    .orderBy(desc(invoices.createdAt));

  if (billInvoices.length === 0) return [];

  const billIds = billInvoices.map((b) => b.id);

  const returnRows = await db
    .select({ originalInvoiceId: invoices.originalInvoiceId, totalAmount: invoices.totalAmount })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        inArray(invoices.originalInvoiceId, billIds),
        ne(invoices.status, "void"),
      ),
    );

  const paymentRows = await db
    .select({ invoiceId: payments.invoiceId, amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), inArray(payments.invoiceId, billIds)));

  const returnsByInvoice = new Map<string, number>();
  for (const r of returnRows) {
    if (!r.originalInvoiceId) continue;
    returnsByInvoice.set(r.originalInvoiceId, (returnsByInvoice.get(r.originalInvoiceId) ?? 0) + Number(r.totalAmount));
  }

  const paidByInvoice = new Map<string, number>();
  for (const p of paymentRows) {
    if (!p.invoiceId) continue;
    paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + Number(p.amount));
  }

  return billInvoices.map((invoice) => {
    const returnsTotal = returnsByInvoice.get(invoice.id) ?? 0;
    const paidTotal = paidByInvoice.get(invoice.id) ?? 0;
    const netAmount = Number(invoice.totalAmount) - returnsTotal;
    const balanceDue = netAmount - paidTotal;
    const status: PartyBill["status"] =
      invoice.status === "void" ? "void" : balanceDue <= 0.01 ? "paid" : paidTotal > 0 ? "partial" : "unpaid";
    return { invoice, returnsTotal, netAmount, paidTotal, balanceDue, status };
  });
}

export type ChequeRegisterFilter = {
  status?: "pending" | "cleared" | "bounced";
  dueBefore?: Date;
};

/**
 * Tenant-wide register across every party — a cheque received FROM a customer and a cheque
 * WE issued to a supplier are the same row shape (payments/cheques don't distinguish
 * direction; partyId's own type tells you which), so one list covers both.
 */
export async function listAllCheques(tenantId: string, filter: ChequeRegisterFilter = {}) {
  const conditions = [eq(payments.tenantId, tenantId)];
  if (filter.status) conditions.push(eq(cheques.status, filter.status));
  if (filter.dueBefore) conditions.push(lte(cheques.dueDate, filter.dueBefore));

  const rows = await db
    .select({
      id: cheques.id,
      chequeNo: cheques.chequeNo,
      bankName: cheques.bankName,
      dueDate: cheques.dueDate,
      status: cheques.status,
      amount: payments.amount,
      partyId: payments.partyId,
      partyName: parties.name,
      partyType: parties.type,
      createdAt: payments.createdAt,
    })
    .from(cheques)
    .innerJoin(payments, eq(payments.id, cheques.paymentId))
    .innerJoin(parties, eq(parties.id, payments.partyId))
    .where(and(...conditions))
    .orderBy(asc(cheques.dueDate));

  return rows;
}

export async function hasBouncedCheque(tenantId: string, partyId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: cheques.id })
    .from(cheques)
    .innerJoin(payments, eq(payments.id, cheques.paymentId))
    .where(and(eq(payments.tenantId, tenantId), eq(payments.partyId, partyId), eq(cheques.status, "bounced")))
    .limit(1);
  return !!row;
}

export async function updateChequeStatus(tenantId: string, chequeId: string, status: "cleared" | "bounced") {
  return db.transaction(async (tx) => {
    const [cheque] = await tx.select().from(cheques).where(eq(cheques.id, chequeId)).for("update");
    if (!cheque) throw new HttpError(404, "Cheque not found");

    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, cheque.paymentId), eq(payments.tenantId, tenantId)))
      .limit(1);
    if (!payment) throw new HttpError(404, "Cheque not found");

    if (cheque.status !== "pending") {
      throw new HttpError(409, `Cheque is already ${cheque.status}`);
    }

    const [updated] = await tx.update(cheques).set({ status }).where(eq(cheques.id, chequeId)).returning();

    if (status === "bounced") {
      // reverse the original credit — the customer's balance goes back up, but history
      // shows both the original payment attempt and this reversal, never a deletion
      await postLedgerEntry(tx, {
        tenantId,
        partyId: payment.partyId,
        direction: "debit",
        amount: Number(payment.amount),
        sourceType: "cheque_bounce",
        sourceId: chequeId,
      });
    }

    return updated;
  });
}
