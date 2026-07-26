import { Router } from "express";
import { requireRole } from "../../middleware/role.middleware.js";
import * as ledgerController from "./ledger.controller.js";

export const ledgerRoutes = Router({ mergeParams: true });

ledgerRoutes.get("/", ledgerController.history);
ledgerRoutes.post("/opening-balance", requireRole("owner", "manager"), ledgerController.openingBalance);
ledgerRoutes.post("/adjustment", requireRole("owner", "manager"), ledgerController.adjustment);
