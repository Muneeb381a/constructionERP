import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { invoiceItems, invoices, parties, products, tenants, units } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { embedTenantLogo } from "../../lib/pdfLogo.js";
import { A4, PAGE_LEFT, PAGE_RIGHT, PAGE_TOP, PDF_COLORS, drawAccentBar, drawPill } from "../../lib/pdfTheme.js";

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
  const page = pdfDoc.addPage(A4);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const { ink, muted, hairline, accent, accentSoft, zebra, danger, dangerSoft } = PDF_COLORS;

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
  y -= 22;
  drawPill(page, (TYPE_LABELS[invoice.type] ?? invoice.type).toUpperCase(), left, y, bold, { size: 9 });
  if (invoice.status === "void") {
    drawPill(page, "VOID — DELETED", left + 150, y, bold, { size: 9, bg: dangerSoft, color: danger });
  }
  y -= 26;

  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: hairline });
  y -= 18;

  page.drawText("Invoice No", { x: left, y, size: 8, font: bold, color: muted });
  page.drawText("Date", { x: left + 180, y, size: 8, font: bold, color: muted });
  page.drawText("Status", { x: right - 90, y, size: 8, font: bold, color: muted });
  y -= 13;
  page.drawText(invoice.invoiceNo, { x: left, y, size: 10, font, color: ink });
  page.drawText(invoice.createdAt!.toLocaleString(), { x: left + 180, y, size: 10, font, color: ink });
  page.drawText(invoice.status, { x: right - 90, y, size: 10, font, color: invoice.status === "void" ? danger : ink });
  y -= 20;

  if (party) {
    const label = invoice.type.startsWith("purchase") ? "Supplier" : "Customer";
    page.drawText(label, { x: left, y, size: 8, font: bold, color: muted });
    y -= 13;
    page.drawText(`${party.name}${party.phone ? "  ·  " + party.phone : ""}`, { x: left, y, size: 10, font, color: ink });
    y -= 20;
  }
  if (invoice.originalInvoiceId) {
    page.drawText(`Against invoice: ${invoice.originalInvoiceId}`, { x: left, y, size: 9, font, color: muted });
    y -= 16;
  }

  y -= 6;
  const col = { product: left + 8, unit: 280, qty: 340, price: 410, total: right - 8 };
  const headerY = y;
  page.drawRectangle({ x: left, y: headerY - 6, width: right - left, height: 22, color: accentSoft });
  page.drawText("Product", { x: col.product, y, size: 9, font: bold, color: accent });
  page.drawText("Unit", { x: col.unit, y, size: 9, font: bold, color: accent });
  page.drawText("Qty", { x: col.qty, y, size: 9, font: bold, color: accent });
  page.drawText("Price", { x: col.price, y, size: 9, font: bold, color: accent });
  page.drawText("Total", { x: col.total - font.widthOfTextAtSize("Total", 9), y, size: 9, font: bold, color: accent });
  y -= 22;

  items.forEach((item, i) => {
    if (i % 2 === 1) {
      page.drawRectangle({ x: left, y: y - 4, width: right - left, height: 18, color: zebra });
    }
    const name = productNames.get(item.productId) ?? item.productId;
    page.drawText(name.length > 38 ? name.slice(0, 37) + "…" : name, { x: col.product, y, size: 9, font, color: ink });
    page.drawText(unitNames.get(item.unitId) ?? String(item.unitId), { x: col.unit, y, size: 9, font, color: muted });
    const qtyText = item.quantity;
    page.drawText(qtyText, { x: col.qty, y, size: 9, font, color: muted });
    const priceText = Number(item.unitPrice).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    page.drawText(priceText, { x: col.price, y, size: 9, font, color: muted });
    const totalText = Number(item.lineTotal).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    page.drawText(totalText, { x: col.total - font.widthOfTextAtSize(totalText, 9), y, size: 9, font: bold, color: ink });
    y -= 18;
  });

  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: hairline });
  y -= 20;

  const summaryLabelX = 380;
  function summaryRow(label: string, value: string, size = 10, color = muted, valueColor = ink) {
    page.drawText(label, { x: summaryLabelX, y, size, font, color });
    const w = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: right - w, y, size, font: size > 10 ? bold : font, color: valueColor });
    y -= size + 8;
  }

  summaryRow("Subtotal", Number(invoice.subtotal).toLocaleString("en-PK", { minimumFractionDigits: 2 }));
  if (Number(invoice.discount) > 0) {
    summaryRow("Discount", "−" + Number(invoice.discount).toLocaleString("en-PK", { minimumFractionDigits: 2 }));
  }
  for (const charge of invoice.otherCharges ?? []) {
    summaryRow(charge.label, Number(charge.amount).toLocaleString("en-PK", { minimumFractionDigits: 2 }));
  }

  y -= 4;
  // Label stacked above the value, not beside it — a side-by-side line only works up to
  // however many digits happen to fit before colliding with the label; stacked has no
  // such ceiling, so a very large total never runs into "TOTAL".
  const boxX = summaryLabelX - 14;
  const boxWidth = right - boxX;
  const boxHeight = 40;
  const boxTop = y + 10;
  const boxBottom = boxTop - boxHeight;
  page.drawRectangle({ x: boxX, y: boxBottom, width: boxWidth, height: boxHeight, color: accentSoft });
  page.drawRectangle({ x: boxX, y: boxBottom, width: 4, height: boxHeight, color: accent });
  page.drawText("TOTAL", { x: boxX + 14, y: boxTop - 14, size: 9, font: bold, color: accent });
  const totalText = Number(invoice.totalAmount).toLocaleString("en-PK", { minimumFractionDigits: 2 });
  const totalWidth = bold.widthOfTextAtSize(totalText, 16);
  page.drawText(totalText, { x: right - 12 - totalWidth, y: boxBottom + 12, size: 16, font: bold, color: ink });
  y = boxBottom - 20;

  page.drawText("Thank you for your business!", {
    x: left,
    y: 60,
    size: 9,
    font: italic,
    color: muted,
  });

  return pdfDoc.save();
}
