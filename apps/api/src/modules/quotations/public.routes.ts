import { Router } from "express";
import * as quotationsController from "./quotations.controller.js";

// Deliberately NOT behind authenticate() — the no-login customer-facing quotation view
// and accept action, gated only by possession of an unguessable per-quotation token.
export const publicQuotationRoutes = Router();

publicQuotationRoutes.get("/:token", quotationsController.publicView);
publicQuotationRoutes.post("/:token/accept", quotationsController.publicAccept);
