import type { Request, Response } from "express";
import * as reportsService from "./reports.service.js";
import { generateBusinessSummaryPdf, generatePartyLedgerSummaryPdf } from "./reports-pdf.service.js";
import { agingReportQuerySchema, partyLedgerSummaryQuerySchema, reportsQuerySchema, topProductsQuerySchema } from "./reports.schema.js";

export async function salesTrend(req: Request, res: Response) {
  const { dateFrom, dateTo } = reportsQuerySchema.parse(req.query);
  const result = await reportsService.getSalesTrend(req.auth!.tenantId, dateFrom, dateTo);
  res.json(result);
}

export async function topProducts(req: Request, res: Response) {
  const { dateFrom, dateTo, limit } = topProductsQuerySchema.parse(req.query);
  const result = await reportsService.getTopProducts(req.auth!.tenantId, dateFrom, dateTo, limit);
  res.json(result);
}

export async function profitSummary(req: Request, res: Response) {
  const { dateFrom, dateTo } = reportsQuerySchema.parse(req.query);
  const result = await reportsService.getProfitSummary(req.auth!.tenantId, dateFrom, dateTo);
  res.json(result);
}

export async function profitByProduct(req: Request, res: Response) {
  const { dateFrom, dateTo } = reportsQuerySchema.parse(req.query);
  const result = await reportsService.getProfitByProduct(req.auth!.tenantId, dateFrom, dateTo);
  res.json(result);
}

export async function agingReport(req: Request, res: Response) {
  const { partyType } = agingReportQuerySchema.parse(req.query);
  const result = await reportsService.getAgingReport(req.auth!.tenantId, partyType);
  res.json(result);
}

export async function reorderSuggestions(req: Request, res: Response) {
  const result = await reportsService.getReorderSuggestions(req.auth!.tenantId);
  res.json(result);
}

export async function partyLedgerSummary(req: Request, res: Response) {
  const { partyType, dateFrom, dateTo } = partyLedgerSummaryQuerySchema.parse(req.query);
  const result = await reportsService.getPartyLedgerSummary(req.auth!.tenantId, partyType, dateFrom, dateTo);
  res.json(result);
}

export async function businessSummaryPdf(req: Request, res: Response) {
  const { dateFrom, dateTo } = reportsQuerySchema.parse(req.query);
  const pdfBytes = await generateBusinessSummaryPdf(req.auth!.tenantId, dateFrom, dateTo);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="business-summary.pdf"`);
  res.send(Buffer.from(pdfBytes));
}

export async function partyLedgerSummaryPdf(req: Request, res: Response) {
  const { partyType, dateFrom, dateTo } = partyLedgerSummaryQuerySchema.parse(req.query);
  const pdfBytes = await generatePartyLedgerSummaryPdf(req.auth!.tenantId, partyType, dateFrom, dateTo);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${partyType}-ledger-report.pdf"`);
  res.send(Buffer.from(pdfBytes));
}
