import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as reconciliationController from "./reconciliation.controller.js";

export const reconciliationRoutes = Router();

reconciliationRoutes.use(authenticate);
reconciliationRoutes.post("/reconcile", requireRole("owner"), reconciliationController.trigger);
