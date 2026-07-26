import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as cashbookController from "./cashbook.controller.js";

export const cashbookRoutes = Router();

cashbookRoutes.use(authenticate);
cashbookRoutes.use(requireRole("owner", "manager", "accountant"));

cashbookRoutes.get("/", cashbookController.list);
cashbookRoutes.get("/balance", cashbookController.balance);
cashbookRoutes.post("/", requireRole("owner", "manager"), cashbookController.create);
