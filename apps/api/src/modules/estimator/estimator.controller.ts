import type { Request, Response } from "express";
import { generateEstimateSlipPdf } from "./estimator.service.js";
import { estimateSlipSchema } from "./estimator.schema.js";

export async function pdf(req: Request, res: Response) {
  const input = estimateSlipSchema.parse(req.body);
  const bytes = await generateEstimateSlipPdf(req.auth!.tenantId, input);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="material-estimate.pdf"');
  res.send(Buffer.from(bytes));
}
