import type { Request, Response } from "express";
import { platformLoginSchema, platformRefreshSchema, platformLogoutSchema } from "./platformAdmin.auth.schema.js";
import { platformLogin, platformLogout, platformRefresh } from "./platformAdmin.auth.service.js";

function requestMeta(req: Request) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

export async function login(req: Request, res: Response) {
  const input = platformLoginSchema.parse(req.body);
  const result = await platformLogin(input, requestMeta(req));
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const input = platformRefreshSchema.parse(req.body);
  const result = await platformRefresh(input.refreshToken, requestMeta(req));
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  const input = platformLogoutSchema.parse(req.body);
  await platformLogout(input.refreshToken);
  res.status(204).send();
}
