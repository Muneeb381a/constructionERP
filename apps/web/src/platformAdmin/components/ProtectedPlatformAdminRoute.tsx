import { Navigate, Outlet } from "react-router-dom";
import { usePlatformAdminAuthStore } from "../store/platformAdminAuthStore";

export function ProtectedPlatformAdminRoute() {
  const accessToken = usePlatformAdminAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/platform-admin/login" replace />;
  return <Outlet />;
}
