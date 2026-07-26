import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as categoriesController from "./categories.controller.js";

export const categoriesRoutes = Router();

categoriesRoutes.use(authenticate);

categoriesRoutes.get("/", categoriesController.list);
categoriesRoutes.post("/", requireRole("owner", "manager"), categoriesController.create);
categoriesRoutes.patch("/:id", requireRole("owner", "manager"), categoriesController.update);
categoriesRoutes.delete("/:id", requireRole("owner", "manager"), categoriesController.remove);
