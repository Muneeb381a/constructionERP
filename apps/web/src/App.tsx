import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PartiesPage } from "./pages/PartiesPage";
import { PartyDetailPage } from "./pages/PartyDetailPage";
import { SaleInvoicePage } from "./pages/SaleInvoicePage";
import { PurchaseInvoicePage } from "./pages/PurchaseInvoicePage";
import { InvoicesListPage } from "./pages/InvoicesListPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { ReturnInvoicePage } from "./pages/ReturnInvoicePage";
import { QuotationsListPage } from "./pages/QuotationsListPage";
import { CreateQuotationPage } from "./pages/CreateQuotationPage";
import { QuotationDetailPage } from "./pages/QuotationDetailPage";
import { StockPage } from "./pages/StockPage";
import { CashBookPage } from "./pages/CashBookPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { EmployeeDetailPage } from "./pages/EmployeeDetailPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { PublicBalancePage } from "./pages/PublicBalancePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/balance/:token" element={<PublicBalancePage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/sale" element={<SaleInvoicePage />} />
          <Route path="/purchase" element={<PurchaseInvoicePage />} />
          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/invoices/:id/return" element={<ReturnInvoicePage />} />
          <Route path="/quotations" element={<QuotationsListPage />} />
          <Route path="/quotations/new" element={<CreateQuotationPage />} />
          <Route path="/quotations/:id" element={<QuotationDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/parties" element={<PartiesPage />} />
          <Route path="/parties/:id" element={<PartyDetailPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/cash-book" element={<CashBookPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
