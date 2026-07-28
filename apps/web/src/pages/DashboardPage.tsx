import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, HandCoins, Landmark, MessageCircle, PackagePlus, ShoppingCart, Trophy, Wallet } from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { formatCurrency } from "../lib/format";
import { buildLowStockAlertMessage, buildWhatsAppShareLink } from "../lib/whatsapp";
import { useAuthStore } from "../store/authStore";
import { getTopCustomers } from "../lib/api/parties";
import type { DashboardSummary } from "../lib/types";

const ACCENT = {
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", icon: "text-blue-600 dark:text-blue-400" },
  orange: { bg: "bg-orange-50 dark:bg-orange-500/10", icon: "text-orange-600 dark:text-orange-400" },
  green: { bg: "bg-green-50 dark:bg-green-500/10", icon: "text-green-600 dark:text-green-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-500/10", icon: "text-violet-600 dark:text-violet-400" },
};

function PrimaryStat({
  icon: Icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: typeof ShoppingCart;
  accent: keyof typeof ACCENT;
  label: string;
  value: string;
  sub?: string;
}) {
  const colors = ACCENT[accent];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.bg}`}>
          <Icon size={18} className={colors.icon} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

function LowStockMeter({ current, min }: { current: number; min: number }) {
  const ratio = min > 0 ? Math.max(0, current) / min : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const critical = current <= 0 || ratio < 0.34;
  const fillColor = critical ? "#d03b3b" : "#fab219";

  return (
    <div className="flex items-center gap-2">
      {critical && <AlertTriangle size={13} style={{ color: fillColor }} className="shrink-0" />}
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: fillColor }} />
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {current} / {min}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canViewDashboard = role === "owner" || role === "manager" || role === "accountant";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await apiClient.get<DashboardSummary>("/dashboard/summary");
      return res.data;
    },
    enabled: canViewDashboard,
  });

  const { data: topCustomers } = useQuery({
    queryKey: ["top-customers", 5],
    queryFn: () => getTopCustomers(5),
    enabled: canViewDashboard,
  });

  if (!canViewDashboard) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.restricted")}</p>;
  }

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.loading")}</p>;
  if (isError || !data) return <p className="text-sm text-red-600 dark:text-red-400">{t("dashboard.loadFailed")}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.today")}</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PrimaryStat
          icon={ShoppingCart}
          accent="blue"
          label={t("dashboard.todaySales")}
          value={formatCurrency(data.today.sales.total)}
          sub={t("dashboard.invoiceCount", { count: data.today.sales.count })}
        />
        <PrimaryStat
          icon={PackagePlus}
          accent="orange"
          label={t("dashboard.todayPurchases")}
          value={formatCurrency(data.today.purchases.total)}
          sub={t("dashboard.invoiceCount", { count: data.today.purchases.count })}
        />
        <PrimaryStat icon={Wallet} accent="green" label={t("dashboard.cashInHand")} value={formatCurrency(data.cashInHand)} />
      </div>

      {/* outstanding pair */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.outstanding")}</h2>
        <div className="grid grid-cols-1 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 p-5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENT.green.bg}`}>
              <HandCoins size={18} className={ACCENT.green.icon} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.receivable")}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data.outstanding.receivables)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENT.violet.bg}`}>
              <Landmark size={18} className={ACCENT.violet.icon} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.payable")}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data.outstanding.payables)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* low stock */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <AlertTriangle size={15} className="text-amber-500" />
            {t("dashboard.lowStock")}
          </h2>
          {data.lowStock.length > 0 && (
            <a
              href={buildWhatsAppShareLink(
                buildLowStockAlertMessage(data.lowStock.map((i) => ({ name: i.name, currentStock: Number(i.currentStock), minStock: Number(i.minStock) }))),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              <MessageCircle size={13} />
              Send Alert
            </a>
          )}
        </div>
        {data.lowStock.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.noLowStock")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Stock vs Minimum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.lowStock.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.name}</td>
                    <td className="px-4 py-3">
                      <LowStockMeter current={Number(item.currentStock)} min={Number(item.minStock)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* top customers */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Trophy size={15} className="text-amber-500" />
          Top Customers
        </h2>
        {!topCustomers || topCustomers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No customer sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Orders</th>
                  <th className="px-4 py-2.5 font-medium">Total Spent</th>
                  <th className="px-4 py-2.5 font-medium">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {topCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${customer.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{customer.orderCount}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{formatCurrency(Number(customer.totalSpent))}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(customer.lastPurchaseAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
