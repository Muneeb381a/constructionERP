import type { Request, Response } from "express";
import * as reconciliationService from "./reconciliation.service.js";

export async function trigger(req: Request, res: Response) {
  const mismatches = await reconciliationService.reconcileAllBalances(req.auth!.tenantId);
  res.json({ mismatchesFound: mismatches.length, mismatches });
}
