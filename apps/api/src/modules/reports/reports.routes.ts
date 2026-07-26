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
reportsRoutes.get("/aging", reportsController.agingReport);
reportsRoutes.get("/reorder-suggestions", reportsController.reorderSuggestions);
