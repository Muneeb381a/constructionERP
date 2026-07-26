import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as categoriesService from "./categories.service.js";
import { createCategorySchema, updateCategorySchema } from "./categories.schema.js";

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new HttpError(400, "Invalid category id");
  return id;
}

export async function list(req: Request, res: Response) {
  const result = await categoriesService.listCategories(req.auth!.tenantId);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createCategorySchema.parse(req.body);
  const category = await categoriesService.createCategory(req.auth!.tenantId, input);
  res.status(201).json(category);
}

export async function update(req: Request, res: Response) {
  const input = updateCategorySchema.parse(req.body);
  const category = await categoriesService.updateCategory(req.auth!.tenantId, parseId(req.params.id as string), input);
  res.json(category);
}

export async function remove(req: Request, res: Response) {
  await categoriesService.deleteCategory(req.auth!.tenantId, parseId(req.params.id as string));
  res.status(204).send();
}
