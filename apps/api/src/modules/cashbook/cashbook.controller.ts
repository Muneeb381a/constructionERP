import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as cashbookService from "./cashbook.service.js";
import { createCashBookEntrySchema, listCashBookQuerySchema } from "./cashbook.schema.js";

export async function create(req: Request, res: Response) {
  const input = createCashBookEntrySchema.parse(req.body);
  const entry = await cashbookService.createEntry(req.auth!.tenantId, input);
  res.status(201).json(entry);
}

export async function list(req: Request, res: Response) {
  const query = listCashBookQuerySchema.parse(req.query);
  const result = await cashbookService.listEntries(req.auth!.tenantId, query);
  res.json(result);
}

export async function balance(req: Request, res: Response) {
  const branchId = req.query.branchId;
  if (typeof branchId !== "string") throw new HttpError(400, "branchId query param is required");
  const result = await cashbookService.getBranchBalance(req.auth!.tenantId, branchId);
  res.json(result);
}
