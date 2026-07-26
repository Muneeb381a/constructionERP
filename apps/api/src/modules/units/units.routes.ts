import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as unitsController from "./units.controller.js";

export const unitsRoutes = Router();

unitsRoutes.use(authenticate);

unitsRoutes.get("/", unitsController.list);
unitsRoutes.post("/", requireRole("owner", "manager"), unitsController.create);
unitsRoutes.patch("/:id", requireRole("owner", "manager"), unitsController.update);
unitsRoutes.delete("/:id", requireRole("owner", "manager"), unitsController.remove);
