import { Router } from "express";
import { authenticatePlatformAdmin } from "../../../middleware/platformAuth.middleware.js";
import * as auditController from "./platformAdmin.audit.controller.js";

export const platformAdminAuditRoutes = Router();

platformAdminAuditRoutes.use(authenticatePlatformAdmin);
platformAdminAuditRoutes.get("/", auditController.list);
