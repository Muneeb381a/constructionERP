import { Router } from "express";
import * as invoicesController from "./invoices.controller.js";

// Deliberately NOT behind authenticate() — the no-login customer-facing order tracking
// view, gated only by possession of an unguessable per-invoice token.
export const publicTrackingRoutes = Router();

publicTrackingRoutes.get("/:token", invoicesController.publicTracking);
