import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema.js";
import { embedTenantLogo } from "../../lib/pdfLogo.js";
import { A4, PAGE_LEFT, PAGE_RIGHT, PAGE_TOP, PDF_COLORS, drawAccentBar, drawPill } from "../../lib/pdfTheme.js";
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
  let page = pdfDoc.addPage(A4);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { ink, muted, hairline, accent, accentSoft, zebra, danger } = PDF_COLORS;

  const left = PAGE_LEFT;
  const right = PAGE_RIGHT;
  let y = PAGE_TOP;
  let rowIndex = 0;

  async function newPageIfNeeded() {
    if (y > 60) return;
    page = pdfDoc.addPage(A4);
    await drawAccentBar(page);
    y = PAGE_TOP - 20;
    drawTableHeader();
  }

  const col = { invoice: left + 8, date: 175, total: 285, paid: 370, due: right - 8 };

  function drawTableHeader() {
    const headerY = y;
    page.drawRectangle({ x: left, y: headerY - 6, width: right - left, height: 22, color: accentSoft });
    page.drawText("Invoice", { x: col.invoice, y, size: 9, font: bold, color: accent });
    page.drawText("Date", { x: col.date, y, size: 9, font: bold, color: accent });
    page.drawText("Total", { x: col.total, y, size: 9, font: bold, color: accent });
    page.drawText("Paid", { x: col.paid, y, size: 9, font: bold, color: accent });
    page.drawText("Balance Due", { x: col.due - font.widthOfTextAtSize("Balance Due", 9), y, size: 9, font: bold, color: accent });
    y -= 22;
  }

  await drawAccentBar(page);

  const logo = await embedTenantLogo(pdfDoc, tenant.logoUrl);
  if (logo) {
    const dims = logo.scaleToFit(70, 50);
    page.drawImage(logo, { x: right - dims.width, y: y - dims.height + 14, width: dims.width, height: dims.height });
  }

  page.drawText(tenant.businessName, { x: left, y, size: 20, font: bold, color: ink });
  y -= 16;
  if (tenant.address) {
    page.drawText(tenant.address, { x: left, y, size: 9, font, color: muted });
    y -= 13;
  }
  if (tenant.phone) {
    page.drawText(tenant.phone, { x: left, y, size: 9, font, color: muted });
    y -= 13;
  }
  y -= 8;
  drawPill(page, "ACCOUNT STATEMENT", left, y, bold, { size: 10 });
  const dateLabel = new Date().toLocaleDateString();
  page.drawText(dateLabel, { x: right - font.widthOfTextAtSize(dateLabel, 9), y, size: 9, font, color: muted });
  y -= 26;

  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: hairline });
  y -= 18;

  page.drawText(party.type === "supplier" ? "Supplier" : "Customer", { x: left, y, size: 8, font: bold, color: muted });
  y -= 13;
  page.drawText(party.name, { x: left, y, size: 12, font: bold, color: ink });
  y -= 15;
  const contactLine = [party.phone, party.address].filter(Boolean).join("  ·  ");
  if (contactLine) {
    page.drawText(contactLine, { x: left, y, size: 9, font, color: muted });
    y -= 15;
  }
  y -= 8;

  drawTableHeader();

  for (const bill of openBills) {
    await newPageIfNeeded();
    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: left, y: y - 4, width: right - left, height: 18, color: zebra });
    }
    page.drawText(bill.invoice.invoiceNo, { x: col.invoice, y, size: 9, font, color: ink });
    page.drawText(new Date(bill.invoice.createdAt!).toLocaleDateString(), { x: col.date, y, size: 9, font, color: muted });
    const totalText = Number(bill.invoice.totalAmount).toLocaleString("en-PK", { minimumFractionDigits: 2 });
    page.drawText(totalText, { x: col.total, y, size: 9, font, color: muted });
    const paidText = bill.paidTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 });
    page.drawText(paidText, { x: col.paid, y, size: 9, font, color: muted });
    const due = Math.max(0, bill.balanceDue);
    const dueText = due.toLocaleString("en-PK", { minimumFractionDigits: 2 });
    page.drawText(dueText, {
      x: col.due - font.widthOfTextAtSize(dueText, 9),
      y,
      size: 9,
      font: bold,
      color: due > 0.01 ? danger : ink,
    });
    y -= 18;
    rowIndex++;
  }

  if (openBills.length === 0) {
    page.drawText("No bills on record.", { x: left, y, size: 10, font, color: muted });
    y -= 18;
  }

  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: hairline });
  y -= 16;

  // Label sits above the value rather than beside it — a side-by-side layout collides
  // for a long label ("Total Outstanding") paired with a large peso-style number; a
  // stacked layout never runs out of room regardless of how many digits the balance is.
  const boxX = 330;
  const boxWidth = right - boxX;
  const boxHeight = 42;
  const boxTop = y + 12;
  const boxBottom = boxTop - boxHeight;
  page.drawRectangle({ x: boxX, y: boxBottom, width: boxWidth, height: boxHeight, color: accentSoft });
  page.drawRectangle({ x: boxX, y: boxBottom, width: 4, height: boxHeight, color: accent });
  page.drawText("TOTAL OUTSTANDING", { x: boxX + 14, y: boxTop - 14, size: 8, font: bold, color: accent });
  const outstandingText = Number(party.cachedBalance).toLocaleString("en-PK", { minimumFractionDigits: 2 });
  const outstandingWidth = bold.widthOfTextAtSize(outstandingText, 16);
  page.drawText(outstandingText, { x: right - 12 - outstandingWidth, y: boxBottom + 12, size: 16, font: bold, color: ink });

  return pdfDoc.save();
}
