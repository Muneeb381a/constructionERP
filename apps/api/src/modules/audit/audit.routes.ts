import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as auditController from "./audit.controller.js";

export const auditRoutes = Router();

auditRoutes.use(authenticate);
auditRoutes.use(requireRole("owner", "manager"));

auditRoutes.get("/", auditController.list);
