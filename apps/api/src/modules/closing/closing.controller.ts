import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as closingService from "./closing.service.js";
import { createClosingSchema } from "./closing.schema.js";

function branchIdOf(req: Request): string {
  const branchId = req.auth!.branchId;
  if (!branchId) throw new HttpError(400, "Your account isn't assigned to a branch");
  return branchId;
}

export async function preview(req: Request, res: Response) {
  const result = await closingService.getTodayClosingPreview(req.auth!.tenantId, branchIdOf(req));
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createClosingSchema.parse(req.body);
  const result = await closingService.createClosing(req.auth!.tenantId, branchIdOf(req), req.auth!.sub, input);
  res.status(201).json(result);
}

export async function list(req: Request, res: Response) {
  const result = await closingService.listClosings(req.auth!.tenantId, branchIdOf(req));
  res.json(result);
}
