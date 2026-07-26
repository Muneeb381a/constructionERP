import type { Request, Response } from "express";
import { db } from "../../db/index.js";
import { HttpError } from "../../middleware/error.middleware.js";
import * as stockService from "./stock.service.js";
import * as transfersService from "./transfers.service.js";
import { adjustStockSchema, createTransferSchema } from "./stock.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(raw: string, field: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, `Invalid ${field}`);
  return raw;
}

export async function byProduct(req: Request, res: Response) {
  const productId = parseUuid(req.params.productId as string, "productId");
  const result = await stockService.listStockForProduct(req.auth!.tenantId, productId);
  res.json(result);
}

export async function byWarehouse(req: Request, res: Response) {
  const warehouseId = parseUuid(req.params.warehouseId as string, "warehouseId");
  const result = await stockService.listStockForWarehouse(req.auth!.tenantId, warehouseId);
  res.json(result);
}

export async function movements(req: Request, res: Response) {
  const productId = parseUuid(req.params.productId as string, "productId");
  const result = await stockService.listMovementsForProduct(req.auth!.tenantId, productId);
  res.json(result);
}

export async function adjust(req: Request, res: Response) {
  const input = adjustStockSchema.parse(req.body);
  const tenantId = req.auth!.tenantId;

  const updated = await db.transaction((tx) =>
    stockService.adjustStock(tx, {
      tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantityChange: input.quantityChange,
      reason: "adjustment",
    }),
  );

  res.json(updated);
}

export async function createTransfer(req: Request, res: Response) {
  const input = createTransferSchema.parse(req.body);
  const result = await transfersService.createTransfer({ tenantId: req.auth!.tenantId, userId: req.auth!.sub }, input);
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

export async function listTransfers(req: Request, res: Response) {
  const productId = req.query.productId ? parseUuid(req.query.productId as string, "productId") : undefined;
  const warehouseId = req.query.warehouseId ? parseUuid(req.query.warehouseId as string, "warehouseId") : undefined;
  const result = await transfersService.listTransfers(req.auth!.tenantId, { productId, warehouseId });
  res.json(result);
}
