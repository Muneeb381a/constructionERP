import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as usersController from "./users.controller.js";

export const usersRoutes = Router();

usersRoutes.use(authenticate);

usersRoutes.get("/", requireRole("owner", "manager"), usersController.list);
usersRoutes.post("/", requireRole("owner", "manager"), usersController.create);
usersRoutes.patch("/:id", requireRole("owner", "manager"), usersController.update);
