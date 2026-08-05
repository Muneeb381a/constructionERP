import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/error.middleware.js";
import * as reconciliationService from "./reconciliation.service.js";

export async function trigger(req: Request, res: Response) {
  const mismatches = await reconciliationService.reconcileAllBalances(req.auth!.tenantId, "manual");
  res.json({ mismatchesFound: mismatches.length, mismatches });
}

export async function lastRun(req: Request, res: Response) {
  const run = await reconciliationService.getLastReconciliationRun(req.auth!.tenantId);
  res.json(run);
}

/**
 * System-wide reconciliation across every tenant, meant to be hit by Vercel Cron (or any
 * scheduler) instead of a logged-in user — there's no persistent process to run node-cron
 * in a serverless deployment. Guarded by a shared secret instead of a user session.
 */
export async function triggerAll(req: Request, res: Response) {
  if (!env.cronSecret) throw new HttpError(503, "CRON_SECRET is not configured on this deployment");
  const header = req.headers.authorization;
  if (header !== `Bearer ${env.cronSecret}`) throw new HttpError(401, "Invalid or missing cron secret");

  const mismatches = await reconciliationService.reconcileAllBalances(undefined, "cron");
  res.json({ mismatchesFound: mismatches.length, mismatches });
}
