import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { getAgingReport, getProfitSummary, getReorderSuggestions, getSalesTrend, getTopProducts } from "../lib/api/reports";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function AgingReportSection() {
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const { data, isLoading } = useQuery({ queryKey: ["reports-aging", partyType], queryFn: () => getAgingReport(partyType) });

  const grandTotal = (data ?? []).reduce((sum, r) => sum + r.total, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Udhaar Aging</h2>
        <div className="flex items-center gap-1 rounded-md border border-gray-300 p-0.5 dark:border-gray-700">
          <button
            onClick={() => setPartyType("customer")}
            className={`rounded px-3 py-1 text-xs font-medium ${partyType === "customer" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
          >
            Customers
          </button>
          <button
            onClick={() => setPartyType("supplier")}
            className={`rounded px-3 py-1 text-xs font-medium ${partyType === "supplier" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
          >
            Suppliers
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2.5 font-medium">{partyType === "customer" ? "Customer" : "Supplier"}</th>
                <th className="px-4 py-2.5 text-right font-medium">0–30 days</th>
                <th className="px-4 py-2.5 text-right font-medium">31–60 days</th>
                <th className="px-4 py-2.5 text-right font-medium">61–90 days</th>
                <th className="px-4 py-2.5 text-right font-medium">90+ days</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.map((row) => (
                <tr key={row.partyId}>
                  <td className="px-4 py-3">
                    <Link to={`/parties/${row.partyId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                      {row.partyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{row.current > 0 ? formatCurrency(row.current) : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{row.d31to60 > 0 ? formatCurrency(row.d31to60) : "—"}</td>
                  <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">{row.d61to90 > 0 ? formatCurrency(row.d61to90) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">{row.d90plus > 0 ? formatCurrency(row.d90plus) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.total)}</td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No outstanding balances.
                  </td>
                </tr>
              )}
            </tbody>
            {data && data.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400" colSpan={5}>
                    Grand Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}

function ReorderSuggestionsSection() {
  const { data, isLoading } = useQuery({ queryKey: ["reports-reorder"], queryFn: getReorderSuggestions });

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Reorder Suggestions</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Nothing below its reorder point right now.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 text-right font-medium">Current</th>
                <th className="px-4 py-2.5 text-right font-medium">Min</th>
                <th className="px-4 py-2.5 text-right font-medium">Suggested Reorder</th>
                <th className="px-4 py-2.5 text-right font-medium">Days of Stock Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.map((row) => (
                <tr key={row.productId}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {row.currentStock} {row.unitName}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{row.minStock}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                    {row.suggestedReorderQty} {row.unitName}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.daysOfStockLeft == null ? (
                      <span className="text-gray-400 dark:text-gray-500">No sales data</span>
                    ) : (
                      <span className={row.daysOfStockLeft < 7 ? "font-medium text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}>
                        {row.daysOfStockLeft.toFixed(1)} days
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canView = role === "owner" || role === "manager" || role === "accountant";

  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });

  function applyPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateTo(isoDate(to));
    setDateFrom(isoDate(from));
  }

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ["reports-sales-trend", dateFrom, dateTo],
    queryFn: () => getSalesTrend(dateFrom, dateTo),
    enabled: canView,
  });

  const { data: topProducts } = useQuery({
    queryKey: ["reports-top-products", dateFrom, dateTo],
    queryFn: () => getTopProducts(dateFrom, dateTo, 8),
    enabled: canView,
  });

  const { data: profit } = useQuery({
    queryKey: ["reports-profit", dateFrom, dateTo],
    queryFn: () => getProfitSummary(dateFrom, dateTo),
    enabled: canView,
  });

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Reports are available to owners, managers, and accountants only.</p>;
  }

  const maxRevenue = Math.max(1, ...(topProducts ?? []).map((p) => Number(p.revenue)));

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reports</h1>

      {/* filter row — one row, above everything it scopes */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => applyPreset(p.days)}
            className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 text-gray-300 dark:text-gray-700">|</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass + " max-w-40"} />
        <span className="text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass + " max-w-40"} />
      </div>

      {/* profit stat tiles */}
      {profit && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(profit.revenue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Cost</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(profit.estimatedCost)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Profit</p>
            <p className="mt-2 text-2xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(profit.estimatedProfit)}</p>
          </div>
        </div>
      )}
      <p className="-mt-6 text-xs text-gray-400 dark:text-gray-500">
        Profit is estimated using each product's current purchase price as a stand-in for historical cost — a rough margin read, not a
        financial-grade figure.
      </p>

      {/* sales vs purchases trend */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Sales vs Purchases</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {trendLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : (
            <SalesTrendChart data={trend ?? []} />
          )}
        </div>
      </div>

      {/* top products */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Top Products by Revenue</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {!topProducts || topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No sales in this date range.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p) => (
                <div key={p.productId} className="flex items-center gap-3">
                  <p className="w-32 shrink-0 truncate text-sm text-gray-700 dark:text-gray-300" title={p.name}>
                    {p.name}
                  </p>
                  <div className="flex-1">
                    <div
                      className="flex h-6 items-center justify-end rounded bg-blue-600 px-2 dark:bg-blue-500"
                      style={{ width: `${Math.max(4, (Number(p.revenue) / maxRevenue) * 100)}%` }}
                    >
                      <span className="whitespace-nowrap text-xs font-medium text-white">{formatCurrency(Number(p.revenue))}</span>
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500">{p.orderCount} orders</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* udhaar aging */}
      <AgingReportSection />

      {/* reorder suggestions */}
      <ReorderSuggestionsSection />
    </div>
  );
}
