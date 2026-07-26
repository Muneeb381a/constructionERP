import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import * as tenantsController from "./tenants.controller.js";

export const tenantsRoutes = Router();

tenantsRoutes.use(authenticate);
tenantsRoutes.get("/me", tenantsController.me);
