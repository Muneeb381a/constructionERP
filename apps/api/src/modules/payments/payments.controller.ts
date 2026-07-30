import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as paymentsService from "./payments.service.js";
import { createPaymentSchema, updateChequeStatusSchema } from "./payments.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string, field: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, `Invalid ${field}`);
  return raw;
}

export async function create(req: Request, res: Response) {
  const input = createPaymentSchema.parse(req.body);
  const result = await paymentsService.createPayment({ tenantId: req.auth!.tenantId }, input);
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function listForParty(req: Request, res: Response) {
  const partyId = parseId(req.params.partyId as string, "partyId");
  const result = await paymentsService.listPaymentsForParty(req.auth!.tenantId, partyId);
  res.json(result);
}

export async function billsForParty(req: Request, res: Response) {
  const partyId = parseId(req.params.partyId as string, "partyId");
  const result = await paymentsService.listBillsForParty(req.auth!.tenantId, partyId);
  res.json(result);
}

export async function chequeRegister(req: Request, res: Response) {
  const { status, dueBefore } = req.query;
  const result = await paymentsService.listAllCheques(req.auth!.tenantId, {
    status: status === "pending" || status === "cleared" || status === "bounced" ? status : undefined,
    dueBefore: typeof dueBefore === "string" ? new Date(dueBefore) : undefined,
  });
  res.json(result);
}

export async function updateChequeStatus(req: Request, res: Response) {
  const chequeId = parseId(req.params.chequeId as string, "chequeId");
  const input = updateChequeStatusSchema.parse(req.body);
  const cheque = await paymentsService.updateChequeStatus(req.auth!.tenantId, chequeId, input.status);
  res.json(cheque);
}
