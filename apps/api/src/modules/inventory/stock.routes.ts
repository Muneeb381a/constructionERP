import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as stockController from "./stock.controller.js";

export const stockRoutes = Router();

stockRoutes.use(authenticate);

stockRoutes.get("/by-product/:productId", stockController.byProduct);
stockRoutes.get("/by-warehouse/:warehouseId", stockController.byWarehouse);
stockRoutes.get("/movements/:productId", stockController.movements);
stockRoutes.post("/adjust", requireRole("owner", "manager"), stockController.adjust);
stockRoutes.get("/transfers", stockController.listTransfers);
stockRoutes.post("/transfers", requireRole("owner", "manager"), stockController.createTransfer);
