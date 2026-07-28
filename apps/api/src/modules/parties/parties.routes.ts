import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as partiesController from "./parties.controller.js";
import { ledgerRoutes } from "../ledger/ledger.routes.js";
import { partyPaymentsRoutes } from "../payments/payments.routes.js";

export const partiesRoutes = Router();

partiesRoutes.use(authenticate);

partiesRoutes.get("/", partiesController.list);
partiesRoutes.get("/top-customers", partiesController.topCustomers);
partiesRoutes.get("/:id", partiesController.get);
partiesRoutes.post("/", partiesController.create);
partiesRoutes.patch("/:id", partiesController.update);
partiesRoutes.delete("/:id", requireRole("owner", "manager"), partiesController.remove);

partiesRoutes.post("/:id/public-link", requireRole("owner", "manager"), partiesController.getPublicLink);
partiesRoutes.delete("/:id/public-link", requireRole("owner", "manager"), partiesController.revokePublicLink);

partiesRoutes.use("/:partyId/ledger", ledgerRoutes);
partiesRoutes.use("/:partyId/payments", partyPaymentsRoutes);
