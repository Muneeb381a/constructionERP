import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as estimatorController from "./estimator.controller.js";

export const estimatorRoutes = Router();

estimatorRoutes.use(authenticate);
estimatorRoutes.use(requireRole("owner", "manager", "cashier"));

estimatorRoutes.post("/pdf", estimatorController.pdf);
