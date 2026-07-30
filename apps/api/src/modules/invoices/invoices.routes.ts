import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as invoicesController from "./invoices.controller.js";

export const invoicesRoutes = Router();

invoicesRoutes.use(authenticate);

invoicesRoutes.get("/", invoicesController.list);
invoicesRoutes.get("/:id", invoicesController.get);
invoicesRoutes.get("/:id/pdf", invoicesController.downloadPdf);
invoicesRoutes.get("/:id/challan.pdf", invoicesController.downloadChallanPdf);
invoicesRoutes.post("/sale", requireRole("owner", "manager", "cashier"), invoicesController.createSale);
invoicesRoutes.post("/purchase", requireRole("owner", "manager"), invoicesController.createPurchase);
invoicesRoutes.post("/return", requireRole("owner", "manager", "cashier"), invoicesController.createReturn);
invoicesRoutes.post("/:id/void", requireRole("owner", "manager"), invoicesController.voidInvoice);
invoicesRoutes.post("/:id/delivery", requireRole("owner", "manager", "cashier"), invoicesController.assignDelivery);
invoicesRoutes.post("/:id/delivery/complete", requireRole("owner", "manager", "cashier"), invoicesController.markDelivered);
invoicesRoutes.post("/:id/public-link", requireRole("owner", "manager", "cashier"), invoicesController.getPublicLink);
