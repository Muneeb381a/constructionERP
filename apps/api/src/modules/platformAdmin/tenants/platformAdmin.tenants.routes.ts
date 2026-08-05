import { Router } from "express";
import { authenticatePlatformAdmin } from "../../../middleware/platformAuth.middleware.js";
import * as tenantsController from "./platformAdmin.tenants.controller.js";

export const platformAdminTenantsRoutes = Router();

platformAdminTenantsRoutes.use(authenticatePlatformAdmin);

platformAdminTenantsRoutes.get("/", tenantsController.list);
platformAdminTenantsRoutes.get("/:tenantId", tenantsController.detail);
platformAdminTenantsRoutes.post("/", tenantsController.create);
platformAdminTenantsRoutes.post("/:tenantId/suspend", tenantsController.suspend);
platformAdminTenantsRoutes.post("/:tenantId/reactivate", tenantsController.reactivate);
platformAdminTenantsRoutes.post("/:tenantId/close", tenantsController.close);
