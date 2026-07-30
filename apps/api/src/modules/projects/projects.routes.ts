import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as projectsController from "./projects.controller.js";

export const projectsRoutes = Router();

projectsRoutes.use(authenticate);

projectsRoutes.post("/", requireRole("owner", "manager", "cashier"), projectsController.create);
projectsRoutes.get("/", projectsController.list);
projectsRoutes.get("/:id", projectsController.get);
projectsRoutes.patch("/:id/status", requireRole("owner", "manager"), projectsController.updateStatus);
