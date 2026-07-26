import type { Request, Response } from "express";
import * as tenantsService from "./tenants.service.js";

export async function me(req: Request, res: Response) {
  const tenant = await tenantsService.getTenant(req.auth!.tenantId);
  res.json(tenant);
}
