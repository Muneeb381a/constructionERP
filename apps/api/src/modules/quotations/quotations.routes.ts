import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as quotationsController from "./quotations.controller.js";

export const quotationsRoutes = Router();

quotationsRoutes.use(authenticate);

quotationsRoutes.get("/", quotationsController.list);
quotationsRoutes.get("/:id", quotationsController.get);
quotationsRoutes.post("/", requireRole("owner", "manager", "cashier"), quotationsController.create);
quotationsRoutes.patch("/:id/status", requireRole("owner", "manager", "cashier"), quotationsController.updateStatus);
quotationsRoutes.post("/:id/convert", requireRole("owner", "manager", "cashier"), quotationsController.convert);
