import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as invoicesService from "./invoices.service.js";
import * as saleService from "./sale.service.js";
import * as purchaseService from "./purchase.service.js";
import * as returnService from "./return.service.js";
import * as voidService from "./void.service.js";
import { generateInvoicePdf } from "./pdf.service.js";
import { generateDeliveryChallanPdf } from "./challan.service.js";
import { assignDeliverySchema, listInvoicesQuerySchema } from "./invoices.schema.js";
import { createSaleInvoiceSchema } from "./sale.schema.js";
import { createPurchaseInvoiceSchema } from "./purchase.schema.js";
import { createReturnInvoiceSchema } from "./return.schema.js";
import { voidInvoiceSchema } from "./void.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, "Invalid invoice id");
  return raw;
}

export async function list(req: Request, res: Response) {
  const query = listInvoicesQuerySchema.parse(req.query);
  const result = await invoicesService.listInvoices(req.auth!.tenantId, query);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const result = await invoicesService.getInvoice(req.auth!.tenantId, parseId(req.params.id as string));
  res.json(result);
}

export async function createSale(req: Request, res: Response) {
  const input = createSaleInvoiceSchema.parse(req.body);
  const result = await saleService.createSaleInvoice(
    { tenantId: req.auth!.tenantId, userId: req.auth!.sub, role: req.auth!.role },
    input,
  );
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function createReturn(req: Request, res: Response) {
  const input = createReturnInvoiceSchema.parse(req.body);
  const result = await returnService.createReturnInvoice(
    { tenantId: req.auth!.tenantId, userId: req.auth!.sub, role: req.auth!.role },
    input,
  );
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function voidInvoice(req: Request, res: Response) {
  const input = voidInvoiceSchema.parse(req.body);
  const invoice = await voidService.voidInvoice(
    { tenantId: req.auth!.tenantId, userId: req.auth!.sub },
    parseId(req.params.id as string),
    input,
  );
  res.json(invoice);
}

export async function downloadPdf(req: Request, res: Response) {
  const pdfBytes = await generateInvoicePdf(req.auth!.tenantId, parseId(req.params.id as string));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=invoice.pdf");
  res.send(Buffer.from(pdfBytes));
}

export async function downloadChallanPdf(req: Request, res: Response) {
  const pdfBytes = await generateDeliveryChallanPdf(req.auth!.tenantId, parseId(req.params.id as string));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=delivery-challan.pdf");
  res.send(Buffer.from(pdfBytes));
}

export async function assignDelivery(req: Request, res: Response) {
  const input = assignDeliverySchema.parse(req.body);
  const invoice = await invoicesService.assignDelivery(req.auth!.tenantId, parseId(req.params.id as string), input);
  res.json(invoice);
}

export async function markDelivered(req: Request, res: Response) {
  const invoice = await invoicesService.markDelivered(req.auth!.tenantId, parseId(req.params.id as string));
  res.json(invoice);
}

export async function createPurchase(req: Request, res: Response) {
  const input = createPurchaseInvoiceSchema.parse(req.body);
  const result = await purchaseService.createPurchaseInvoice(
    { tenantId: req.auth!.tenantId, userId: req.auth!.sub },
    input,
  );
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function getPublicLink(req: Request, res: Response) {
  const token = await invoicesService.getOrCreateInvoicePublicToken(req.auth!.tenantId, parseId(req.params.id as string));
  res.json({ token });
}

export async function publicTracking(req: Request, res: Response) {
  const token = req.params.token as string;
  // publicToken is a uuid column — a garbage string throws a Postgres type error rather
  // than an empty result, so reject the shape here for a clean 404 instead of a 500.
  if (!UUID_RE.test(token)) throw new HttpError(404, "Invalid or expired link");
  const result = await invoicesService.getPublicTrackingByToken(token);
  res.json(result);
}
