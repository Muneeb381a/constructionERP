import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as branchesController from "./branches.controller.js";

export const branchesRoutes = Router();

branchesRoutes.use(authenticate);

branchesRoutes.get("/", branchesController.list);
branchesRoutes.post("/", requireRole("owner"), branchesController.create);
branchesRoutes.patch("/:id", requireRole("owner"), branchesController.update);
