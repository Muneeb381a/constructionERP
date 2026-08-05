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

// Wage/salary/payment history is financial data about what the business owes a specific
// staff member — same sensitivity as a party's credit limit, not something a cashier should
// be able to look up about a co-worker.
employeesRoutes.get("/:employeeId/ledger", requireRole("owner", "manager"), employeesController.listLedger);

employeesRoutes.get("/:employeeId/salary", requireRole("owner", "manager"), employeesController.listSalaryPostings);
employeesRoutes.post("/:employeeId/salary", requireRole("owner", "manager"), employeesController.postSalary);

employeesRoutes.get("/:employeeId/payments", requireRole("owner", "manager"), employeesController.listPayments);
employeesRoutes.post("/:employeeId/payments", requireRole("owner", "manager"), employeesController.createPayment);
