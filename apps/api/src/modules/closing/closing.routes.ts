import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as closingController from "./closing.controller.js";

export const closingRoutes = Router();

closingRoutes.use(authenticate);
closingRoutes.use(requireRole("owner", "manager"));

closingRoutes.get("/today", closingController.preview);
closingRoutes.post("/", closingController.create);
closingRoutes.get("/", closingController.list);
