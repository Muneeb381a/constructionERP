import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema.js";

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    branchId: user.branchId,
    avatarUrl: user.avatarUrl ?? null,
  };
}

function requestMeta(req: Request) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.registerTenant(input, requestMeta(req));
  res.status(201).json({
    tenant: result.tenant,
    user: serializeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, requestMeta(req));
  res.json({
    user: serializeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const input = refreshSchema.parse(req.body);
  const result = await authService.refresh(input.refreshToken, requestMeta(req));
  res.json({
    user: serializeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

export async function logout(req: Request, res: Response) {
  const input = refreshSchema.parse(req.body);
  await authService.logout(input.refreshToken);
  res.status(204).send();
}
