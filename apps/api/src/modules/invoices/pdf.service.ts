import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { invoiceItems, invoices, parties, products, tenants, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

const TYPE_LABELS: Record<string, string> = {
  sale: "Sale Invoice",
  purchase: "Purchase Invoice",
  sale_return: "Sale Return",
  purchase_return: "Purchase Return",
};

export async function generateInvoicePdf(tenantId: string, invoiceId: string): Promise<Uint8Array> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!invoice) throw new HttpError(404, "Invoice not found");

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const party = invoice.partyId
    ? (await db.select().from(parties).where(eq(parties.id, invoice.partyId)).limit(1))[0]
    : null;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const productRows = productIds.length
    ? await db.select().from(products).where(inArray(products.id, productIds))
    : [];
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
  y -= 26;
  page.drawText(TYPE_LABELS[invoice.type] ?? invoice.type, { x: left, y, size: 13, font: bold, color: black });
  y -= 20;

  page.drawText(`Invoice No: ${invoice.invoiceNo}`, { x: left, y, size: 10, font, color: gray });
  page.drawText(`Status: ${invoice.status}`, { x: right - 120, y, size: 10, font, color: gray });
  y -= 14;
  page.drawText(`Date: ${invoice.createdAt!.toLocaleString()}`, { x: left, y, size: 10, font, color: gray });
  y -= 14;
  if (party) {
    const label = invoice.type.startsWith("purchase") ? "Supplier" : "Customer";
    page.drawText(`${label}: ${party.name}${party.phone ? " · " + party.phone : ""}`, { x: left, y, size: 10, font, color: gray });
    y -= 14;
  }
  if (invoice.originalInvoiceId) {
    page.drawText(`Against invoice: ${invoice.originalInvoiceId}`, { x: left, y, size: 10, font, color: gray });
    y -= 14;
  }

  y -= 10;
  const col = { product: left, unit: 280, qty: 340, price: 410, total: 480 };
  page.drawText("Product", { x: col.product, y, size: 10, font: bold, color: black });
  page.drawText("Unit", { x: col.unit, y, size: 10, font: bold, color: black });
  page.drawText("Qty", { x: col.qty, y, size: 10, font: bold, color: black });
  page.drawText("Price", { x: col.price, y, size: 10, font: bold, color: black });
  page.drawText("Total", { x: col.total, y, size: 10, font: bold, color: black });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 16;

  for (const item of items) {
    page.drawText(productNames.get(item.productId) ?? item.productId, { x: col.product, y, size: 9, font, color: black });
    page.drawText(unitNames.get(item.unitId) ?? String(item.unitId), { x: col.unit, y, size: 9, font, color: black });
    page.drawText(item.quantity, { x: col.qty, y, size: 9, font, color: black });
    page.drawText(item.unitPrice, { x: col.price, y, size: 9, font, color: black });
    page.drawText(item.lineTotal, { x: col.total, y, size: 9, font, color: black });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 20;

  const summaryX = 410;
  page.drawText("Subtotal", { x: summaryX, y, size: 10, font, color: gray });
  page.drawText(invoice.subtotal, { x: col.total, y, size: 10, font, color: black });
  y -= 14;
  page.drawText("Discount", { x: summaryX, y, size: 10, font, color: gray });
  page.drawText(invoice.discount ?? "0.00", { x: col.total, y, size: 10, font, color: black });
  y -= 16;
  page.drawText("Total", { x: summaryX, y, size: 12, font: bold, color: black });
  page.drawText(invoice.totalAmount, { x: col.total, y, size: 12, font: bold, color: black });

  return pdfDoc.save();
}
