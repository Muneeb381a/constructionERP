import type { Request, Response } from "express";
import * as branchesService from "./branches.service.js";
import { createBranchSchema, updateBranchSchema } from "./branches.schema.js";

export async function list(req: Request, res: Response) {
  const result = await branchesService.listBranches(req.auth!.tenantId);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createBranchSchema.parse(req.body);
  const branch = await branchesService.createBranch(req.auth!.tenantId, input);
  res.status(201).json(branch);
}

export async function update(req: Request, res: Response) {
  const input = updateBranchSchema.parse(req.body);
  const branch = await branchesService.updateBranch(req.auth!.tenantId, req.params.id as string, input);
  res.json(branch);
}
