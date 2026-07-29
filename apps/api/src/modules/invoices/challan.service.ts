import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { employees, invoiceItems, invoices, parties, products, tenants, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

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
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  const left = 50;
  const right = 545;
  let y = 790;

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
  page.drawText("DELIVERY CHALLAN", { x: left, y, size: 14, font: bold, color: black });
  y -= 22;

  page.drawText(`Challan / Invoice No: ${invoice.invoiceNo}`, { x: left, y, size: 10, font, color: gray });
  page.drawText(`Date: ${invoice.createdAt!.toLocaleDateString()}`, { x: right - 140, y, size: 10, font, color: gray });
  y -= 16;
  if (party) {
    page.drawText(`To: ${party.name}${party.phone ? " · " + party.phone : ""}`, { x: left, y, size: 10, font, color: gray });
    y -= 14;
    if (party.address) {
      page.drawText(party.address, { x: left, y, size: 9, font, color: gray });
      y -= 14;
    }
  }
  page.drawText(`Driver / Loader: ${driver?.name ?? "—"}${driver?.phone ? " · " + driver.phone : ""}`, { x: left, y, size: 10, font, color: gray });
  y -= 24;

  const col = { product: left, unit: 350, qty: 440 };
  page.drawText("Product", { x: col.product, y, size: 10, font: bold, color: black });
  page.drawText("Unit", { x: col.unit, y, size: 10, font: bold, color: black });
  page.drawText("Quantity", { x: col.qty, y, size: 10, font: bold, color: black });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 16;

  for (const item of items) {
    page.drawText(productNames.get(item.productId) ?? item.productId, { x: col.product, y, size: 9, font, color: black });
    page.drawText(unitNames.get(item.unitId) ?? String(item.unitId), { x: col.unit, y, size: 9, font, color: black });
    page.drawText(item.quantity, { x: col.qty, y, size: 9, font, color: black });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });

  // signature lines near the bottom of the page, not directly under a short item list
  const sigY = Math.min(y - 60, 130);
  page.drawLine({ start: { x: left, y: sigY }, end: { x: left + 160, y: sigY }, thickness: 1, color: gray });
  page.drawText("Dispatched By", { x: left, y: sigY - 14, size: 9, font, color: gray });
  page.drawLine({ start: { x: right - 160, y: sigY }, end: { x: right, y: sigY }, thickness: 1, color: gray });
  page.drawText("Received By", { x: right - 160, y: sigY - 14, size: 9, font, color: gray });

  return pdfDoc.save();
}
