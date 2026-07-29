import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema.js";
import { getParty } from "./parties.service.js";
import { listBillsForParty } from "../payments/payments.service.js";

/** A one-page "give this to the customer / accountant" statement: every bill, what's
 * been paid against it, and what's still due — the same numbers as the Sales History
 * table on their page, just in a document they can keep or forward. */
export async function generatePartyStatementPdf(tenantId: string, partyId: string): Promise<Uint8Array> {
  const party = await getParty(tenantId, partyId);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const bills = await listBillsForParty(tenantId, partyId);
  const openBills = bills.filter((b) => b.status !== "void");

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const red = rgb(0.7, 0.15, 0.15);

  const left = 50;
  const right = 545;
  let y = 790;

  function newPageIfNeeded() {
    if (y > 60) return;
    page = pdfDoc.addPage([595.28, 841.89]);
    y = 790;
  }

  page.drawText(tenant.businessName, { x: left, y, size: 18, font: bold, color: black });
  if (tenant.address) {
    y -= 16;
    page.drawText(tenant.address, { x: left, y, size: 9, font, color: gray });
  }
  if (tenant.phone) {
    y -= 12;
    page.drawText(tenant.phone, { x: left, y, size: 9, font, color: gray });
  }
  y -= 26;
  page.drawText("ACCOUNT STATEMENT", { x: left, y, size: 14, font: bold, color: black });
  page.drawText(new Date().toLocaleDateString(), { x: right - 100, y, size: 10, font, color: gray });
  y -= 22;

  page.drawText(`${party.type === "supplier" ? "Supplier" : "Customer"}: ${party.name}`, { x: left, y, size: 11, font: bold, color: black });
  y -= 15;
  if (party.phone) {
    page.drawText(party.phone, { x: left, y, size: 9, font, color: gray });
    y -= 13;
  }
  if (party.address) {
    page.drawText(party.address, { x: left, y, size: 9, font, color: gray });
    y -= 13;
  }
  y -= 12;

  const col = { invoice: left, date: 160, total: 260, paid: 350, due: 440 };
  page.drawText("Invoice", { x: col.invoice, y, size: 10, font: bold, color: black });
  page.drawText("Date", { x: col.date, y, size: 10, font: bold, color: black });
  page.drawText("Total", { x: col.total, y, size: 10, font: bold, color: black });
  page.drawText("Paid", { x: col.paid, y, size: 10, font: bold, color: black });
  page.drawText("Balance Due", { x: col.due, y, size: 10, font: bold, color: black });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 16;

  for (const bill of openBills) {
    newPageIfNeeded();
    page.drawText(bill.invoice.invoiceNo, { x: col.invoice, y, size: 9, font, color: black });
    page.drawText(new Date(bill.invoice.createdAt!).toLocaleDateString(), { x: col.date, y, size: 9, font, color: black });
    page.drawText(bill.invoice.totalAmount, { x: col.total, y, size: 9, font, color: black });
    page.drawText(bill.paidTotal.toFixed(2), { x: col.paid, y, size: 9, font, color: black });
    const due = Math.max(0, bill.balanceDue);
    page.drawText(due.toFixed(2), { x: col.due, y, size: 9, font, color: due > 0.01 ? red : black });
    y -= 15;
  }

  if (openBills.length === 0) {
    page.drawText("No bills on record.", { x: left, y, size: 10, font, color: gray });
    y -= 15;
  }

  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 22;

  page.drawText("Total Outstanding", { x: col.paid, y, size: 12, font: bold, color: black });
  page.drawText(Number(party.cachedBalance).toFixed(2), { x: col.due, y, size: 12, font: bold, color: black });

  return pdfDoc.save();
}
