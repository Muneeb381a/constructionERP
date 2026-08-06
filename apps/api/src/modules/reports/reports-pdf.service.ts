import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema.js";
import { embedTenantLogo } from "../../lib/pdfLogo.js";
import { getPartyLedgerSummary, getProfitSummary, getSalesTrend, getTopProducts } from "./reports.service.js";

const A4: [number, number] = [595.28, 841.89];

function formatRange(dateFrom: Date, dateTo: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" });
  return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
}

async function newDoc() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(A4);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { pdfDoc, page, font, bold, black: rgb(0, 0, 0), gray: rgb(0.4, 0.4, 0.4), red: rgb(0.7, 0.15, 0.15) };
}

async function drawHeader(
  pdfDoc: PDFDocument,
  page: import("pdf-lib").PDFPage,
  bold: import("pdf-lib").PDFFont,
  font: import("pdf-lib").PDFFont,
  black: ReturnType<typeof rgb>,
  gray: ReturnType<typeof rgb>,
  tenant: typeof tenants.$inferSelect,
  title: string,
  dateFrom: Date,
  dateTo: Date,
) {
  const left = 50;
  const right = 545;
  let y = 790;

  const logo = await embedTenantLogo(pdfDoc, tenant.logoUrl);
  if (logo) {
    const dims = logo.scaleToFit(70, 50);
    page.drawImage(logo, { x: right - dims.width, y: y - dims.height + 14, width: dims.width, height: dims.height });
  }

  page.drawText(tenant.businessName, { x: left, y, size: 18, font: bold, color: black });
  y -= 26;
  page.drawText(title, { x: left, y, size: 13, font: bold, color: black });
  y -= 18;
  page.drawText(`Period: ${formatRange(dateFrom, dateTo)}`, { x: left, y, size: 10, font, color: gray });
  page.drawText(`Generated: ${new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}`, {
    x: right - 150,
    y,
    size: 10,
    font,
    color: gray,
  });
  y -= 24;
  return y;
}

/** "Print it out, keep it in a file" period summary — profit, sales vs purchases, and
 * top products for whatever date range Reports is currently scoped to (a single day for
 * a daily report, a week, a month, or any custom range). */
export async function generateBusinessSummaryPdf(tenantId: string, dateFrom: Date, dateTo: Date): Promise<Uint8Array> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const [profit, trend, topProducts] = await Promise.all([
    getProfitSummary(tenantId, dateFrom, dateTo),
    getSalesTrend(tenantId, dateFrom, dateTo),
    getTopProducts(tenantId, dateFrom, dateTo, 15),
  ]);

  const { pdfDoc, page, font, bold, black, gray } = await newDoc();
  const left = 50;
  const right = 545;
  let y = await drawHeader(pdfDoc, page, bold, font, black, gray, tenant, "Business Summary Report", dateFrom, dateTo);

  const totalSales = trend.reduce((s, d) => s + d.salesTotal, 0);
  const salesCount = trend.reduce((s, d) => s + d.salesCount, 0);
  const totalPurchases = trend.reduce((s, d) => s + d.purchasesTotal, 0);
  const purchasesCount = trend.reduce((s, d) => s + d.purchasesCount, 0);

  page.drawText("Sales vs Purchases", { x: left, y, size: 11, font: bold, color: black });
  y -= 16;
  page.drawText(`Sales: ${totalSales.toFixed(2)} (${salesCount} invoice${salesCount === 1 ? "" : "s"})`, { x: left, y, size: 10, font, color: black });
  y -= 14;
  page.drawText(`Purchases: ${totalPurchases.toFixed(2)} (${purchasesCount} invoice${purchasesCount === 1 ? "" : "s"})`, {
    x: left,
    y,
    size: 10,
    font,
    color: black,
  });
  y -= 24;

  page.drawText("Profit (estimated)", { x: left, y, size: 11, font: bold, color: black });
  y -= 16;
  page.drawText(`Revenue: ${profit.revenue.toFixed(2)}`, { x: left, y, size: 10, font, color: black });
  y -= 14;
  page.drawText(`Estimated Cost: ${profit.estimatedCost.toFixed(2)}`, { x: left, y, size: 10, font, color: black });
  y -= 14;
  page.drawText(`Estimated Profit: ${profit.estimatedProfit.toFixed(2)}`, { x: left, y, size: 10, font: bold, color: black });
  y -= 10;
  page.drawText("(Uses each product's current purchase price as a stand-in for historical cost.)", {
    x: left,
    y,
    size: 8,
    font,
    color: gray,
  });
  y -= 26;

  page.drawText("Top Products by Revenue", { x: left, y, size: 11, font: bold, color: black });
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
  y -= 16;

  const col = { product: left, orders: 380, revenue: 450 };
  page.drawText("Product", { x: col.product, y, size: 9, font: bold, color: black });
  page.drawText("Orders", { x: col.orders, y, size: 9, font: bold, color: black });
  page.drawText("Revenue", { x: col.revenue, y, size: 9, font: bold, color: black });
  y -= 14;

  if (topProducts.length === 0) {
    page.drawText("No sales in this period.", { x: left, y, size: 9, font, color: gray });
  }
  for (const p of topProducts) {
    page.drawText(p.name, { x: col.product, y, size: 9, font, color: black });
    page.drawText(String(p.orderCount), { x: col.orders, y, size: 9, font, color: black });
    page.drawText(Number(p.revenue).toFixed(2), { x: col.revenue, y, size: 9, font, color: black });
    y -= 14;
  }

  return pdfDoc.save();
}

const PARTY_TITLES: Record<"customer" | "supplier", string> = {
  customer: "Customer Ledger Report",
  supplier: "Supplier Ledger Report",
};

/** Every customer/supplier's opening balance, what they took (were billed), what they
 * paid, and where that leaves them — for the selected period. The exact numbers a shop
 * owner files away after switching from a paper register or another system. */
export async function generatePartyLedgerSummaryPdf(
  tenantId: string,
  partyType: "customer" | "supplier",
  dateFrom: Date,
  dateTo: Date,
): Promise<Uint8Array> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const rows = await getPartyLedgerSummary(tenantId, partyType, dateFrom, dateTo);

  const { pdfDoc, font, bold, black, gray, red } = await newDoc();
  let page = pdfDoc.addPage(A4);
  const left = 50;
  const right = 545;
  let y = await drawHeader(pdfDoc, page, bold, font, black, gray, tenant, PARTY_TITLES[partyType], dateFrom, dateTo);

  function newPageIfNeeded() {
    if (y > 60) return;
    page = pdfDoc.addPage(A4);
    y = 790;
  }

  const col = { name: left, opening: 260, taken: 340, paid: 420, closing: 495 };
  const takenLabel = partyType === "supplier" ? "Received" : "Taken";
  const paidLabel = partyType === "supplier" ? "Paid" : "Received";

  function drawTableHeader() {
    page.drawText(partyType === "customer" ? "Customer" : "Supplier", { x: col.name, y, size: 10, font: bold, color: black });
    page.drawText("Opening", { x: col.opening, y, size: 10, font: bold, color: black });
    page.drawText(takenLabel, { x: col.taken, y, size: 10, font: bold, color: black });
    page.drawText(paidLabel, { x: col.paid, y, size: 10, font: bold, color: black });
    page.drawText("Closing", { x: col.closing, y, size: 10, font: bold, color: black });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
    y -= 16;
  }

  drawTableHeader();

  if (rows.length === 0) {
    page.drawText("No activity in this period.", { x: left, y, size: 9, font, color: gray });
    y -= 15;
  }

  let totalOpening = 0;
  let totalTaken = 0;
  let totalPaid = 0;
  let totalClosing = 0;

  for (const row of rows) {
    newPageIfNeeded();
    if (y === 790) drawTableHeader();
    page.drawText(row.partyName, { x: col.name, y, size: 9, font, color: black });
    page.drawText(row.openingBalance.toFixed(2), { x: col.opening, y, size: 9, font, color: black });
    page.drawText(row.periodTaken.toFixed(2), { x: col.taken, y, size: 9, font, color: black });
    page.drawText(row.periodPaid.toFixed(2), { x: col.paid, y, size: 9, font, color: black });
    page.drawText(row.closingBalance.toFixed(2), { x: col.closing, y, size: 9, font: bold, color: row.closingBalance > 0.01 ? red : black });
    y -= 15;

    totalOpening += row.openingBalance;
    totalTaken += row.periodTaken;
    totalPaid += row.periodPaid;
    totalClosing += row.closingBalance;
  }

  if (rows.length > 0) {
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: black });
    y -= 16;
    page.drawText("Total", { x: col.name, y, size: 10, font: bold, color: black });
    page.drawText(totalOpening.toFixed(2), { x: col.opening, y, size: 10, font: bold, color: black });
    page.drawText(totalTaken.toFixed(2), { x: col.taken, y, size: 10, font: bold, color: black });
    page.drawText(totalPaid.toFixed(2), { x: col.paid, y, size: 10, font: bold, color: black });
    page.drawText(totalClosing.toFixed(2), { x: col.closing, y, size: 10, font: bold, color: black });
  }

  return pdfDoc.save();
}
