import type { Request, Response } from "express";
import { listPlatformAuditLogQuerySchema } from "./platformAdmin.audit.schema.js";
import { listPlatformAuditLog } from "./platformAdmin.audit.service.js";

export async function list(req: Request, res: Response) {
  const query = listPlatformAuditLogQuerySchema.parse(req.query);
  const result = await listPlatformAuditLog(query);
  res.json(result);
}
