import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { uploadImage } from "../../middleware/upload.middleware.js";
import * as productsController from "./products.controller.js";

export const productsRoutes = Router();

productsRoutes.use(authenticate);

productsRoutes.get("/", productsController.list);
productsRoutes.get("/:id", productsController.get);
productsRoutes.post("/", requireRole("owner", "manager"), productsController.create);
productsRoutes.patch("/:id", requireRole("owner", "manager"), productsController.update);
productsRoutes.post(
  "/:id/image",
  requireRole("owner", "manager"),
  uploadImage.single("image"),
  productsController.uploadImage,
);

productsRoutes.get("/:id/rate-history", productsController.rateHistory);
productsRoutes.get("/:id/conversions", productsController.listConversions);
productsRoutes.post("/:id/conversions", requireRole("owner", "manager"), productsController.createConversion);
productsRoutes.delete("/:id/conversions/:conversionId", requireRole("owner", "manager"), productsController.deleteConversion);
