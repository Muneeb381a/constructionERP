import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as quotationsService from "./quotations.service.js";
import {
  convertQuotationSchema,
  createQuotationSchema,
  listQuotationsQuerySchema,
  updateQuotationStatusSchema,
} from "./quotations.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, "Invalid quotation id");
  return raw;
}

function ctx(req: Request) {
  return { tenantId: req.auth!.tenantId, userId: req.auth!.sub, role: req.auth!.role };
}

export async function list(req: Request, res: Response) {
  const query = listQuotationsQuerySchema.parse(req.query);
  const result = await quotationsService.listQuotations(req.auth!.tenantId, query);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const result = await quotationsService.getQuotation(req.auth!.tenantId, parseId(req.params.id as string));
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createQuotationSchema.parse(req.body);
  const result = await quotationsService.createQuotation(ctx(req), input);
  res.status(201).json(result);
}

export async function updateStatus(req: Request, res: Response) {
  const input = updateQuotationStatusSchema.parse(req.body);
  const result = await quotationsService.updateQuotationStatus(req.auth!.tenantId, parseId(req.params.id as string), input.status);
  res.json(result);
}

export async function convert(req: Request, res: Response) {
  const input = convertQuotationSchema.parse(req.body);
  const result = await quotationsService.convertToInvoice(ctx(req), parseId(req.params.id as string), input);
  res.status(201).json(result);
}

export async function getPublicLink(req: Request, res: Response) {
  const token = await quotationsService.getOrCreateQuotationPublicToken(req.auth!.tenantId, parseId(req.params.id as string));
  res.json({ token });
}

function parseToken(raw: string) {
  // publicToken is a uuid column — a garbage string throws a Postgres type error rather
  // than an empty result, so reject the shape here for a clean 404 instead of a 500.
  if (!UUID_RE.test(raw)) throw new HttpError(404, "Invalid or expired link");
  return raw;
}

export async function publicView(req: Request, res: Response) {
  const token = parseToken(req.params.token as string);
  const result = await quotationsService.getPublicQuotationByToken(token);
  res.json(result);
}

export async function publicAccept(req: Request, res: Response) {
  const token = parseToken(req.params.token as string);
  const result = await quotationsService.acceptPublicQuotation(token);
  res.json(result);
}
