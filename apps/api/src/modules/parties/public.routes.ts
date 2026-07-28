import { Router } from "express";
import * as partiesController from "./parties.controller.js";

// Deliberately NOT behind authenticate() — this is the no-login customer-facing balance
// check, gated only by possession of an unguessable per-party token.
export const publicPartyRoutes = Router();

publicPartyRoutes.get("/balance/:token", partiesController.publicBalance);
