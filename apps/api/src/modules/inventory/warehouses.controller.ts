import type { Request, Response } from "express";
import * as warehousesService from "./warehouses.service.js";
import { createWarehouseSchema, updateWarehouseSchema } from "./warehouses.schema.js";

export async function list(req: Request, res: Response) {
  const result = await warehousesService.listWarehouses(req.auth!.tenantId);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createWarehouseSchema.parse(req.body);
  const warehouse = await warehousesService.createWarehouse(req.auth!.tenantId, input);
  res.status(201).json(warehouse);
}

export async function update(req: Request, res: Response) {
  const input = updateWarehouseSchema.parse(req.body);
  const warehouse = await warehousesService.updateWarehouse(req.auth!.tenantId, req.params.id as string, input);
  res.json(warehouse);
}
