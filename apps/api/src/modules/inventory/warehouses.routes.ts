import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as warehousesController from "./warehouses.controller.js";

export const warehousesRoutes = Router();

warehousesRoutes.use(authenticate);

warehousesRoutes.get("/", warehousesController.list);
warehousesRoutes.post("/", requireRole("owner", "manager"), warehousesController.create);
warehousesRoutes.patch("/:id", requireRole("owner", "manager"), warehousesController.update);
