import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { employees, invoiceItems, invoices, parties, products, tenants, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { embedTenantLogo } from "../../lib/pdfLogo.js";
import { A4, PAGE_LEFT, PAGE_RIGHT, PAGE_TOP, PDF_COLORS, drawAccentBar, drawPill } from "../../lib/pdfTheme.js";

/**
 * A delivery challan / gate pass — what leaves with the driver instead of the invoice
 * itself. Deliberately has no prices: it's a quantity-check document for the gate guard
 * and the receiving customer, not a bill.
 */
export async function generateDeliveryChallanPdf(tenantId: string, invoiceId: string): Promise<Uint8Array> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (!invoice.deliveryEmployeeId) throw new HttpError(400, "Assign a delivery employee before printing a challan");

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const party = invoice.partyId ? (await db.select().from(parties).where(eq(parties.id, invoice.partyId)).limit(1))[0] : null;
  const [driver] = await db.select().from(employees).where(eq(employees.id, invoice.deliveryEmployeeId)).limit(1);

  const productIds = [...new Set(items.map((i) => i.productId))];
  const productRows = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
  const productNames = new Map(productRows.map((p) => [p.id, p.name]));

  const unitIds = [...new Set(items.map((i) => i.unitId))];
  const unitRows = unitIds.length ? await db.select().from(units).where(inArray(units.id, unitIds)) : [];
  const unitNames = new Map(unitRows.map((u) => [u.id, u.name]));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(A4);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { ink, muted, hairline, accent, accentSoft, zebra } = PDF_COLORS;

  const left = PAGE_LEFT;
  const right = PAGE_RIGHT;
  let y = PAGE_TOP;

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
  drawPill(page, "DELIVERY CHALLAN", left, y, bold, { size: 10 });
  y -= 26;

  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: hairline });
  y -= 18;

  page.drawText("Challan / Invoice No", { x: left, y, size: 8, font: bold, color: muted });
  page.drawText("Date", { x: right - 140, y, size: 8, font: bold, color: muted });
  y -= 13;
  page.drawText(invoice.invoiceNo, { x: left, y, size: 10, font, color: ink });
  page.drawText(invoice.createdAt!.toLocaleDateString(), { x: right - 140, y, size: 10, font, color: ink });
  y -= 22;

  // Delivery details in a two-column card so the driver and gate guard read it at a
  // glance instead of hunting through a paragraph of plain lines.
  const cardTop = y;
  const cardHeight = party?.address ? 64 : 50;
  page.drawRectangle({ x: left, y: cardTop - cardHeight, width: right - left, height: cardHeight, color: accentSoft });
  let cardY = cardTop - 14;
  page.drawText("DELIVER TO", { x: left + 12, y: cardY, size: 8, font: bold, color: accent });
  page.drawText("DRIVER / LOADER", { x: left + (right - left) / 2 + 6, y: cardY, size: 8, font: bold, color: accent });
  cardY -= 14;
  page.drawText(party ? party.name : "Walk-in / Cash customer", { x: left + 12, y: cardY, size: 10, font: bold, color: ink });
  page.drawText(driver?.name ?? "—", { x: left + (right - left) / 2 + 6, y: cardY, size: 10, font: bold, color: ink });
  cardY -= 14;
  if (party?.phone) page.drawText(party.phone, { x: left + 12, y: cardY, size: 9, font, color: muted });
  if (driver?.phone) page.drawText(driver.phone, { x: left + (right - left) / 2 + 6, y: cardY, size: 9, font, color: muted });
  if (party?.address) {
    cardY -= 14;
    page.drawText(party.address, { x: left + 12, y: cardY, size: 9, font, color: muted });
  }
  y = cardTop - cardHeight - 22;

  const col = { product: left + 8, unit: 350, qty: 440 };
  const headerY = y;
  page.drawRectangle({ x: left, y: headerY - 6, width: right - left, height: 22, color: accentSoft });
  page.drawText("Product", { x: col.product, y, size: 9, font: bold, color: accent });
  page.drawText("Unit", { x: col.unit, y, size: 9, font: bold, color: accent });
  page.drawText("Quantity", { x: col.qty, y, size: 9, font: bold, color: accent });
  y -= 22;

  items.forEach((item, i) => {
    if (i % 2 === 1) {
      page.drawRectangle({ x: left, y: y - 4, width: right - left, height: 18, color: zebra });
    }
    const name = productNames.get(item.productId) ?? item.productId;
    page.drawText(name.length > 44 ? name.slice(0, 43) + "…" : name, { x: col.product, y, size: 9, font, color: ink });
    page.drawText(unitNames.get(item.unitId) ?? String(item.unitId), { x: col.unit, y, size: 9, font, color: muted });
    page.drawText(item.quantity, { x: col.qty, y, size: 9, font: bold, color: ink });
    y -= 18;
  });

  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: hairline });

  page.drawText("No prices shown — this is a delivery record, not a bill.", {
    x: left,
    y: y - 16,
    size: 8,
    font,
    color: muted,
  });

  // signature lines near the bottom of the page, not directly under a short item list
  const sigY = Math.min(y - 70, 130);
  page.drawLine({ start: { x: left, y: sigY }, end: { x: left + 170, y: sigY }, thickness: 1, color: muted });
  page.drawText("Dispatched By", { x: left, y: sigY - 14, size: 9, font, color: muted });
  page.drawLine({ start: { x: right - 170, y: sigY }, end: { x: right, y: sigY }, thickness: 1, color: muted });
  page.drawText("Received By", { x: right - 170, y: sigY - 14, size: 9, font, color: muted });

  return pdfDoc.save();
}
