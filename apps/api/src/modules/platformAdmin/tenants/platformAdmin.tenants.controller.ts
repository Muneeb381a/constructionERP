import type { Request, Response } from "express";
import {
  closeTenantSchema,
  createTenantSchema,
  listTenantsQuerySchema,
  suspendTenantSchema,
} from "./platformAdmin.tenants.schema.js";
import {
  closeTenant,
  getTenantDetail,
  listTenants,
  platformCreateTenant,
  reactivateTenant,
  suspendTenant,
} from "./platformAdmin.tenants.service.js";

function requestMeta(req: Request) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

export async function list(req: Request, res: Response) {
  const query = listTenantsQuerySchema.parse(req.query);
  res.json(await listTenants(query));
}

export async function detail(req: Request, res: Response) {
  res.json(await getTenantDetail(req.params.tenantId as string));
}

export async function create(req: Request, res: Response) {
  const input = createTenantSchema.parse(req.body);
  const result = await platformCreateTenant(req.platformAuth!.id, input, requestMeta(req));
  res.status(201).json(result);
}

export async function suspend(req: Request, res: Response) {
  const input = suspendTenantSchema.parse(req.body);
  const result = await suspendTenant(req.platformAuth!.id, req.params.tenantId as string, input.reason, requestMeta(req));
  res.json(result);
}

export async function reactivate(req: Request, res: Response) {
  const result = await reactivateTenant(req.platformAuth!.id, req.params.tenantId as string, requestMeta(req));
  res.json(result);
}

export async function close(req: Request, res: Response) {
  const input = closeTenantSchema.parse(req.body);
  const result = await closeTenant(req.platformAuth!.id, req.params.tenantId as string, input.reason, requestMeta(req));
  res.json(result);
}
