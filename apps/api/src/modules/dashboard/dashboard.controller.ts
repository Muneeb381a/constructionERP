import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.js";
import { dashboardQuerySchema } from "./dashboard.schema.js";

export async function summary(req: Request, res: Response) {
  const { branchId } = dashboardQuerySchema.parse(req.query);
  const tenantId = req.auth!.tenantId;

  const [today, cashInHand, outstanding, lowStock] = await Promise.all([
    dashboardService.getTodaySummary(tenantId, branchId),
    dashboardService.getCashInHand(tenantId, branchId),
    dashboardService.getOutstanding(tenantId),
    dashboardService.getLowStock(tenantId),
  ]);

  res.json({ today, cashInHand, outstanding, lowStock });
}
