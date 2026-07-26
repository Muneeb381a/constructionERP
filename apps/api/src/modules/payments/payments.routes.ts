import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as paymentsController from "./payments.controller.js";

export const paymentsRoutes = Router();

paymentsRoutes.use(authenticate);

paymentsRoutes.post("/", paymentsController.create);
paymentsRoutes.patch(
  "/cheques/:chequeId/status",
  requireRole("owner", "manager", "accountant"),
  paymentsController.updateChequeStatus,
);

// nested under /api/parties/:partyId/payments
export const partyPaymentsRoutes = Router({ mergeParams: true });
partyPaymentsRoutes.get("/", paymentsController.listForParty);
partyPaymentsRoutes.get("/bills", paymentsController.billsForParty);
