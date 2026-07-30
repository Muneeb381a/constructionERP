import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as ledgerController from "./ledger.controller.js";

export const ledgerRoutes = Router({ mergeParams: true });

ledgerRoutes.get("/", ledgerController.history);
ledgerRoutes.post("/opening-balance", requireRole("owner", "manager"), ledgerController.openingBalance);
ledgerRoutes.post("/adjustment", requireRole("owner", "manager"), ledgerController.adjustment);

// Tenant-wide feed (every party, not nested under a single :partyId) — mounted separately at /api/ledger.
export const ledgerAllRoutes = Router();
ledgerAllRoutes.use(authenticate);
ledgerAllRoutes.get("/", requireRole("owner", "manager", "accountant"), ledgerController.listAll);
ledgerAllRoutes.get("/verify-integrity", requireRole("owner", "manager"), ledgerController.verifyIntegrity);
