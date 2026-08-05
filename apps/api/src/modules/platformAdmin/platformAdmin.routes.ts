import { Router } from "express";
import { platformAdminAuthRoutes } from "./auth/platformAdmin.auth.routes.js";
import { platformAdminTenantsRoutes } from "./tenants/platformAdmin.tenants.routes.js";
import { platformAdminAuditRoutes } from "./audit/platformAdmin.audit.routes.js";

export const platformAdminRoutes = Router();

platformAdminRoutes.use("/auth", platformAdminAuthRoutes);
platformAdminRoutes.use("/tenants", platformAdminTenantsRoutes);
platformAdminRoutes.use("/audit-log", platformAdminAuditRoutes);
