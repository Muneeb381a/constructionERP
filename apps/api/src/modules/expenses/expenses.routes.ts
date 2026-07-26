import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as expensesController from "./expenses.controller.js";

export const expensesRoutes = Router();

expensesRoutes.use(authenticate);

expensesRoutes.get("/", expensesController.list);
expensesRoutes.get("/category-summary", expensesController.categorySummary);
expensesRoutes.post("/", requireRole("owner", "manager"), expensesController.create);
