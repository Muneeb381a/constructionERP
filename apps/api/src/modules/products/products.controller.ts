import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import { uploadBuffer } from "../../lib/cloudinary.js";
import * as productsService from "./products.service.js";
import * as conversionsService from "./conversions.service.js";
import {
  bulkPriceUpdateSchema,
  createConversionSchema,
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "./products.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseProductId(raw: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, "Invalid product id");
  return raw;
}

function parseConversionId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new HttpError(400, "Invalid conversion id");
  return id;
}

export async function list(req: Request, res: Response) {
  const query = listProductsQuerySchema.parse(req.query);
  const result = await productsService.listProducts(req.auth!.tenantId, query);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const product = await productsService.getProduct(req.auth!.tenantId, parseProductId(req.params.id as string));
  res.json(product);
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  const product = await productsService.createProduct(req.auth!.tenantId, input);
  res.status(201).json(product);
}

export async function update(req: Request, res: Response) {
  const input = updateProductSchema.parse(req.body);
  const product = await productsService.updateProduct(req.auth!.tenantId, parseProductId(req.params.id as string), input);
  res.json(product);
}

export async function bulkUpdatePrices(req: Request, res: Response) {
  const input = bulkPriceUpdateSchema.parse(req.body);
  const result = await productsService.bulkUpdatePrices(req.auth!.tenantId, input);
  res.json(result);
}

export async function uploadImage(req: Request, res: Response) {
  const productId = parseProductId(req.params.id as string);
  if (!req.file) throw new HttpError(400, "No image file provided (field name: image)");

  // ownership check first — don't spend a Cloudinary upload on a product that isn't this tenant's
  await productsService.getProduct(req.auth!.tenantId, productId);

  const imageUrl = await uploadBuffer(req.file.buffer, `construction-erp/${req.auth!.tenantId}/products`);
  const product = await productsService.setProductImage(req.auth!.tenantId, productId, imageUrl);
  res.json(product);
}

export async function rateHistory(req: Request, res: Response) {
  const result = await productsService.getRateHistory(req.auth!.tenantId, parseProductId(req.params.id as string));
  res.json(result);
}

export async function listConversions(req: Request, res: Response) {
  const result = await conversionsService.listConversions(req.auth!.tenantId, parseProductId(req.params.id as string));
  res.json(result);
}

export async function createConversion(req: Request, res: Response) {
  const input = createConversionSchema.parse(req.body);
  const conversion = await conversionsService.createConversion(
    req.auth!.tenantId,
    parseProductId(req.params.id as string),
    input,
  );
  res.status(201).json(conversion);
}

export async function deleteConversion(req: Request, res: Response) {
  await conversionsService.deleteConversion(
    req.auth!.tenantId,
    parseProductId(req.params.id as string),
    parseConversionId(req.params.conversionId as string),
  );
  res.status(204).send();
}
