import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { uploadImage } from "../../middleware/upload.middleware.js";
import * as tenantsController from "./tenants.controller.js";

export const tenantsRoutes = Router();

tenantsRoutes.use(authenticate);
tenantsRoutes.get("/me", tenantsController.me);
tenantsRoutes.patch("/me", requireRole("owner", "manager"), tenantsController.update);
tenantsRoutes.post("/me/logo", requireRole("owner", "manager"), uploadImage.single("logo"), tenantsController.uploadLogo);
