import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as rateLocksController from "./rateLocks.controller.js";

export const rateLocksRoutes = Router();

rateLocksRoutes.use(authenticate);

rateLocksRoutes.post("/", requireRole("owner", "manager"), rateLocksController.create);
rateLocksRoutes.get("/party/:partyId", rateLocksController.listForParty);
