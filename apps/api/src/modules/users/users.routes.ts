import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { uploadImage } from "../../middleware/upload.middleware.js";
import * as usersController from "./users.controller.js";

export const usersRoutes = Router();

usersRoutes.use(authenticate);

// "/me" routes are open to every role (self-service profile) and must be registered
// before "/:id" — otherwise Express would match "me" as an :id param on that route first.
usersRoutes.get("/me", usersController.me);
usersRoutes.patch("/me", usersController.updateMe);
usersRoutes.post("/me/avatar", uploadImage.single("avatar"), usersController.uploadMyAvatar);

usersRoutes.get("/", requireRole("owner", "manager"), usersController.list);
usersRoutes.post("/", requireRole("owner", "manager"), usersController.create);
usersRoutes.patch("/:id", requireRole("owner", "manager"), usersController.update);
