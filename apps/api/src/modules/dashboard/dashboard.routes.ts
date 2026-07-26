import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as dashboardController from "./dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);
dashboardRoutes.use(requireRole("owner", "manager", "accountant"));

dashboardRoutes.get("/summary", dashboardController.summary);
