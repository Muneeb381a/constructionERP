import type { Request, Response } from "express";
import * as auditService from "./audit.service.js";
import { listAuditLogQuerySchema } from "./audit.schema.js";

export async function list(req: Request, res: Response) {
  const query = listAuditLogQuerySchema.parse(req.query);
  const result = await auditService.listAuditLog(req.auth!.tenantId, query);
  res.json(result);
}
