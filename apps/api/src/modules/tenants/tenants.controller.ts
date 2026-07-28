import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import { uploadBuffer } from "../../lib/cloudinary.js";
import * as tenantsService from "./tenants.service.js";
import { updateTenantSchema } from "./tenants.schema.js";

export async function me(req: Request, res: Response) {
  const tenant = await tenantsService.getTenant(req.auth!.tenantId);
  res.json(tenant);
}

export async function update(req: Request, res: Response) {
  const input = updateTenantSchema.parse(req.body);
  const tenant = await tenantsService.updateTenant(req.auth!.tenantId, input);
  res.json(tenant);
}

export async function uploadLogo(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "No image file provided (field name: logo)");
  const logoUrl = await uploadBuffer(req.file.buffer, `construction-erp/${req.auth!.tenantId}/branding`);
  const tenant = await tenantsService.setTenantLogo(req.auth!.tenantId, logoUrl);
  res.json(tenant);
}
