import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import * as employeesController from "./employees.controller.js";

export const employeesRoutes = Router();

employeesRoutes.use(authenticate);

employeesRoutes.get("/", employeesController.list);
employeesRoutes.get("/attendance/today", employeesController.today);
employeesRoutes.post("/", requireRole("owner", "manager"), employeesController.create);
employeesRoutes.get("/:id", employeesController.get);
employeesRoutes.patch("/:id", requireRole("owner", "manager"), employeesController.update);
employeesRoutes.delete("/:id", requireRole("owner", "manager"), employeesController.remove);

employeesRoutes.get("/:employeeId/attendance", employeesController.listAttendance);
employeesRoutes.post("/:employeeId/attendance", requireRole("owner", "manager"), employeesController.markAttendance);

employeesRoutes.get("/:employeeId/ledger", employeesController.listLedger);

employeesRoutes.get("/:employeeId/salary", employeesController.listSalaryPostings);
employeesRoutes.post("/:employeeId/salary", requireRole("owner", "manager"), employeesController.postSalary);

employeesRoutes.get("/:employeeId/payments", employeesController.listPayments);
employeesRoutes.post("/:employeeId/payments", requireRole("owner", "manager"), employeesController.createPayment);
