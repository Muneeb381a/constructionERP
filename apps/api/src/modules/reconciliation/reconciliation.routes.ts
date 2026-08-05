import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as reconciliationController from "./reconciliation.controller.js";

export const reconciliationRoutes = Router();

// Registered before authenticate() — this is a system/cron endpoint, secured by its own
// shared-secret check in the controller, not a logged-in user's session.
reconciliationRoutes.post("/reconcile-all", reconciliationController.triggerAll);

reconciliationRoutes.use(authenticate);
reconciliationRoutes.post("/reconcile", requireRole("owner"), reconciliationController.trigger);
reconciliationRoutes.get("/reconcile/last-run", requireRole("owner", "manager"), reconciliationController.lastRun);
