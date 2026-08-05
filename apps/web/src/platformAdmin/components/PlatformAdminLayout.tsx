import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, LogOut, ScrollText, ShieldAlert } from "lucide-react";
import { usePlatformAdminAuthStore } from "../store/platformAdminAuthStore";
import { logoutPlatformAdmin } from "../lib/platformAdminApi";

const navItems = [
  { to: "/platform-admin/tenants", label: "Shops", icon: Building2 },
  { to: "/platform-admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export function PlatformAdminLayout() {
  const navigate = useNavigate();
  const admin = usePlatformAdminAuthStore((s) => s.admin);
  const refreshToken = usePlatformAdminAuthStore((s) => s.refreshToken);
  const clearAuth = usePlatformAdminAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    if (refreshToken) await logoutPlatformAdmin(refreshToken).catch(() => {});
    clearAuth();
    navigate("/platform-admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Persistent, unmistakable banner — this context must never be confused with a tenant dashboard. */}
      <div className="flex items-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-950">
        <ShieldAlert size={14} />
        Platform Admin — actions here affect real client shops
      </div>

      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Construction ERP — Operator Console</span>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">{admin?.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
