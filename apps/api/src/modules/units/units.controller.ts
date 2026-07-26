import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as unitsService from "./units.service.js";
import { createUnitSchema, updateUnitSchema } from "./units.schema.js";

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new HttpError(400, "Invalid unit id");
  return id;
}

export async function list(req: Request, res: Response) {
  const result = await unitsService.listUnits(req.auth!.tenantId);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createUnitSchema.parse(req.body);
  const unit = await unitsService.createUnit(req.auth!.tenantId, input);
  res.status(201).json(unit);
}

export async function update(req: Request, res: Response) {
  const input = updateUnitSchema.parse(req.body);
  const unit = await unitsService.updateUnit(req.auth!.tenantId, parseId(req.params.id as string), input);
  res.json(unit);
}

export async function remove(req: Request, res: Response) {
  await unitsService.deleteUnit(req.auth!.tenantId, parseId(req.params.id as string));
  res.status(204).send();
}
