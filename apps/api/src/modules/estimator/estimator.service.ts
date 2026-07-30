import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema.js";
import { embedTenantLogo } from "../../lib/pdfLogo.js";
import type { EstimateSlipInput } from "./estimator.schema.js";

/**
 * A "here's what this will need" slip for the Material Estimator — deliberately stateless
 * (nothing is persisted; the calculation lives entirely in the browser). Any line whose
 * material was linked to a real product carries a unitPrice, so the total only reflects
 * materials the shop actually confirmed a price for, not the full unlinked list.
 */
export async function generateEstimateSlipPdf(tenantId: string, input: EstimateSlipInput): Promise<Uint8Array> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  const left = 50;
  const right = 545;
  let y = 790;

  const logo = await embedTenantLogo(pdfDoc, tenant.logoUrl);
  if (logo) {
    const dims = logo.scaleToFit(70, 50);
    page.drawImage(logo, { x: right - dims.width, y: y - dims.height + 14, width: dims.width, height: dims.height });
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
  page.drawText("MATERIAL ESTIMATE", { x: left, y, size: 14, font: bold, color: black });
  page.drawText(new Date().toLocaleDateString(), { x: right - 100, y, size: 10, font, color: gray });
  y -= 20;

  page.drawText(input.title, { x: left, y, size: 11, font: bold, color: black });
  y -= 15;
  if (input.customerName) {
    page.drawText(`Customer: ${input.customerName}`, { x: left, y, size: 9, font, color: gray });
    y -= 13;
  }
  if (input.dimensionsNote) {
    page.drawText(input.dimensionsNote, { x: left, y, size: 9, font, color: gray });
    y -= 13;
  }
  y -= 10;

  const hasCosts = input.lines.some((l) => l.unitPrice != null);
  const col = { material: left, qty: 280, unit: 350, product: 410 };
  page.drawText("Material", { x: col.material, y, size: 10, font: bold, color: black });
  page.drawText("Quantity", { x: col.qty, y, size: 10, font: bold, color: black });
  page.drawText("Unit", { x: col.unit, y, size: 10, font: bold, color: black });
  if (hasCosts) page.drawText("Linked Product", { x: col.product, y, size: 10, font: bold, color: black });
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 16;

  let totalCost = 0;
  for (const line of input.lines) {
    page.drawText(line.label, { x: col.material, y, size: 9, font, color: black });
    page.drawText(String(line.qty), { x: col.qty, y, size: 9, font, color: black });
    page.drawText(line.unit, { x: col.unit, y, size: 9, font, color: black });
    if (line.productName) page.drawText(line.productName, { x: col.product, y, size: 9, font, color: black });
    if (line.unitPrice != null) totalCost += line.qty * line.unitPrice;
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 22;

  if (totalCost > 0) {
    page.drawText("Estimated Cost (linked items only)", { x: col.material, y, size: 11, font: bold, color: black });
    page.drawText(totalCost.toFixed(2), { x: col.product, y, size: 11, font: bold, color: black });
    y -= 24;
  }

  page.drawText(
    "Estimate only — a rule-of-thumb calculation, not a structural design. Actual quantities can vary with",
    { x: left, y, size: 8, font: italic, color: gray },
  );
  y -= 11;
  page.drawText(
    "wastage, site conditions, and design. Confirm exact requirements with a contractor or engineer.",
    { x: left, y, size: 8, font: italic, color: gray },
  );

  return pdfDoc.save();
}
