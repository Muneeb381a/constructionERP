import { Router } from "express";
import rateLimit from "../../../lib/rateLimit.js";
import { env } from "../../../config/env.js";
import * as authController from "./platformAdmin.auth.controller.js";

export const platformAdminAuthRoutes = Router();

// Stricter than the tenant authLimiter (20/15min) — this is the single most powerful
// credential in the system.
const platformLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts — please wait a few minutes and try again." },
});

if (env.platformAdminIpAllowlist?.length) {
  platformAdminAuthRoutes.use("/login", (req, res, next) => {
    const ip = req.ip ?? "";
    if (!env.platformAdminIpAllowlist!.includes(ip)) {
      return res.status(403).json({ error: "Access denied from this network" });
    }
    next();
  });
}

platformAdminAuthRoutes.post("/login", platformLoginLimiter, authController.login);
platformAdminAuthRoutes.post("/refresh", authController.refresh);
platformAdminAuthRoutes.post("/logout", authController.logout);
