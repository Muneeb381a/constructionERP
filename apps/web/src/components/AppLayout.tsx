import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  BookText,
  Calculator,
  ClipboardCheck,
  FileText,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../store/authStore";
import { LanguageSwitcher } from "./LanguageSwitcher";

const navGroups = [
  {
    labelKey: "nav.groupOverview",
    items: [
      { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { to: "/reports", key: "reports", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.groupTransactions",
    items: [
      { to: "/sale", key: "newSale", icon: ShoppingCart },
      { to: "/purchase", key: "newPurchase", icon: Truck },
      { to: "/invoices", key: "invoices", icon: Receipt },
      { to: "/quotations", key: "quotations", icon: FileText },
      { to: "/estimator", key: "estimator", icon: Calculator },
    ],
  },
  {
    labelKey: "nav.groupCatalog",
    items: [
      { to: "/customers", key: "customers", icon: Users },
      { to: "/products", key: "products", icon: Package },
    ],
  },
  {
    labelKey: "nav.groupOperations",
    items: [
      { to: "/stock", key: "stock", icon: Warehouse },
      { to: "/cash-book", key: "cashBook", icon: Wallet },
      { to: "/ledger", key: "ledger", icon: BookText },
      { to: "/expenses", key: "expenses", icon: ReceiptText },
      { to: "/employees", key: "employees", icon: HardHat },
      { to: "/closing", key: "closing", icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "nav.groupAdmin",
    items: [
      { to: "/audit-log", key: "auditLog", icon: ShieldCheck },
      { to: "/settings", key: "settings", icon: Settings },
    ],
  },
] as const;

function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    try {
      if (refreshToken) await apiClient.post("/auth/logout", { refreshToken });
    } catch {
      // logout is best-effort client-side regardless of whether the server call succeeds
    }
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          C
        </div>
        <span className="text-base font-semibold text-gray-900">{t("app.name")}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.labelKey} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`
                    }
                  >
                    <Icon size={18} strokeWidth={2} className="shrink-0" />
                    {t(`nav.${item.key}`)}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-gray-200 p-3">
        <LanguageSwitcher />
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Link
            to="/settings"
            title="Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-xs font-semibold text-blue-700"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user?.name)
            )}
          </Link>
          <Link to="/settings" className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="truncate text-xs capitalize text-gray-500">{user?.role}</p>
          </Link>
          <button
            onClick={handleLogout}
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
            className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 start-0 w-64">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute end-3 top-3 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:ps-64">
        <header className="flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden dark:border-gray-800 dark:bg-gray-900">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Menu size={20} />
          </button>
          <Link to="/dashboard" className="font-semibold text-gray-900 dark:text-gray-100">
            {t("app.name")}
          </Link>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
