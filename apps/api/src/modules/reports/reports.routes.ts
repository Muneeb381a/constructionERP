import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as reportsController from "./reports.controller.js";

export const reportsRoutes = Router();

reportsRoutes.use(authenticate);
reportsRoutes.use(requireRole("owner", "manager", "accountant"));

reportsRoutes.get("/sales-trend", reportsController.salesTrend);
reportsRoutes.get("/top-products", reportsController.topProducts);
reportsRoutes.get("/profit-summary", reportsController.profitSummary);
reportsRoutes.get("/profit-by-product", reportsController.profitByProduct);
reportsRoutes.get("/aging", reportsController.agingReport);
reportsRoutes.get("/reorder-suggestions", reportsController.reorderSuggestions);
reportsRoutes.get("/party-ledger-summary", reportsController.partyLedgerSummary);
reportsRoutes.get("/summary.pdf", reportsController.businessSummaryPdf);
reportsRoutes.get("/party-ledger-summary.pdf", reportsController.partyLedgerSummaryPdf);
