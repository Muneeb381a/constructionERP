import express from "express";
import cors from "cors";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { branchesRoutes } from "./modules/branches/branches.routes.js";
import { categoriesRoutes } from "./modules/categories/categories.routes.js";
import { unitsRoutes } from "./modules/units/units.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { warehousesRoutes } from "./modules/inventory/warehouses.routes.js";
import { stockRoutes } from "./modules/inventory/stock.routes.js";
import { partiesRoutes } from "./modules/parties/parties.routes.js";
import { invoicesRoutes } from "./modules/invoices/invoices.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { cashbookRoutes } from "./modules/cashbook/cashbook.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { reconciliationRoutes } from "./modules/reconciliation/reconciliation.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { quotationsRoutes } from "./modules/quotations/quotations.routes.js";
import { tenantsRoutes } from "./modules/tenants/tenants.routes.js";
import { employeesRoutes } from "./modules/employees/employees.routes.js";
import { expensesRoutes } from "./modules/expenses/expenses.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/units", unitsRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/parties", partiesRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/cash-book", cashbookRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", reconciliationRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/quotations", quotationsRoutes);
app.use("/api/tenants", tenantsRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/audit-log", auditRoutes);

app.use(errorHandler);

// Named export for src/index.ts (traditional long-running server) and local scripts.
// Default export is what Vercel's zero-config Express detection requires — it looks for
// src/server.ts specifically and needs *this* file's default export, not a wrapper
// elsewhere; see https://vercel.com/docs/frameworks/backend/express.
export default app;
