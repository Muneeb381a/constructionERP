import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedPlatformAdminRoute } from "./components/ProtectedPlatformAdminRoute";
import { PlatformAdminLayout } from "./components/PlatformAdminLayout";
import { PlatformAdminLoginPage } from "./pages/PlatformAdminLoginPage";
import { TenantsListPage } from "./pages/TenantsListPage";
import { TenantDetailPage } from "./pages/TenantDetailPage";
import { CreateTenantPage } from "./pages/CreateTenantPage";
import { PlatformAuditLogPage } from "./pages/PlatformAuditLogPage";

// Kept entirely inside platformAdmin/ so the separation from the tenant-facing app holds
// at the routing layer too, not just auth/storage.
export function PlatformAdminApp() {
  return (
    <Routes>
      <Route path="login" element={<PlatformAdminLoginPage />} />

      <Route element={<ProtectedPlatformAdminRoute />}>
        <Route element={<PlatformAdminLayout />}>
          <Route path="tenants" element={<TenantsListPage />} />
          <Route path="tenants/new" element={<CreateTenantPage />} />
          <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
          <Route path="audit-log" element={<PlatformAuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="tenants" replace />} />
    </Routes>
  );
}
