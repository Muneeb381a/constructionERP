import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as rateLocksService from "./rateLocks.service.js";
import { createRateLockSchema } from "./rateLocks.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string, field: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, `Invalid ${field}`);
  return raw;
}

export async function create(req: Request, res: Response) {
  const input = createRateLockSchema.parse(req.body);
  const lock = await rateLocksService.createRateLock(req.auth!.tenantId, req.auth!.sub, input);
  res.status(201).json(lock);
}

export async function listForParty(req: Request, res: Response) {
  const partyId = parseId(req.params.partyId as string, "partyId");
  const onlyActive = req.query.active === "true";
  const result = onlyActive
    ? await rateLocksService.listActiveRateLocksForParty(req.auth!.tenantId, partyId)
    : await rateLocksService.listRateLocksForParty(req.auth!.tenantId, partyId);
  res.json(result);
}
