import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Clock3, LineChart, PackageSearch, ShoppingCart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { Loader } from "../components/Loader";
import { Modal } from "../components/Modal";
import { PartyPicker } from "../components/PartyPicker";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { getAgingReport, getProfitByProduct, getProfitSummary, getReorderSuggestions, getSalesTrend, getTopProducts } from "../lib/api/reports";
import type { Party } from "../lib/api/parties";
import type { ReorderState } from "./PurchaseInvoicePage";

function marginBadgeClass(margin: number) {
  if (margin < 0) return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (margin < 15) return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
}

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
  const { data, isLoading, isError } = useQuery({ queryKey: ["reports-aging", partyType], queryFn: () => getAgingReport(partyType) });

  const grandTotal = (data ?? []).reduce((sum, r) => sum + r.total, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Clock3 size={16} className="text-gray-400" />
          Udhaar Aging
        </h2>
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
          <Loader />
        ) : isError ? (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">Failed to load the aging report. Try refreshing.</p>
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
                    <Link to={`/customers/${row.partyId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
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

function ReorderModal({
  items,
  onClose,
}: {
  items: { productId: string; unitId: number; quantity: number }[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Party | null>(null);

  function handleCreate() {
    const state: ReorderState = { reorder: { partyId: supplier?.id ?? null, items } };
    navigate("/purchase", { state });
  }

  return (
    <Modal title="Create Purchase from Suggestions" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {items.length} item{items.length === 1 ? "" : "s"} will be added to a new Purchase Invoice at today's purchase prices.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier (optional)</label>
          <PartyPicker type="supplier" placeholder="Search supplier…" selected={supplier} onSelect={setSupplier} onClear={() => setSupplier(null)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={handleCreate} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Continue to Purchase
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReorderSuggestionsSection() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["reports-reorder"], queryFn: getReorderSuggestions });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showReorderModal, setShowReorderModal] = useState(false);

  function toggle(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  const rows = data ?? [];
  const selectedItems = rows
    .filter((r) => selected.has(r.productId))
    .map((r) => ({ productId: r.productId, unitId: r.unitId, quantity: r.suggestedReorderQty }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <PackageSearch size={16} className="text-gray-400" />
          Reorder Suggestions
        </h2>
        {rows.length > 0 && (
          <button
            onClick={() => {
              if (selected.size === 0) setSelected(new Set(rows.map((r) => r.productId)));
              setShowReorderModal(true);
            }}
            disabled={selected.size === 0 && rows.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <ShoppingCart size={13} />
            Create Purchase{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <Loader />
        ) : isError ? (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">Failed to load reorder suggestions. Try refreshing.</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Nothing below its reorder point right now.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              <tr>
                <th className="w-8 px-4 py-2.5"></th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 text-right font-medium">Current</th>
                <th className="px-4 py-2.5 text-right font-medium">Min</th>
                <th className="px-4 py-2.5 text-right font-medium">Suggested Reorder</th>
                <th className="px-4 py-2.5 text-right font-medium">Days of Stock Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <tr key={row.productId}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(row.productId)} onChange={() => toggle(row.productId)} className="rounded" />
                  </td>
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

      {showReorderModal && <ReorderModal items={selectedItems} onClose={() => setShowReorderModal(false)} />}
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

  const { data: profitByProduct } = useQuery({
    queryKey: ["reports-profit-by-product", dateFrom, dateTo],
    queryFn: () => getProfitByProduct(dateFrom, dateTo),
    enabled: canView,
  });

  const productRows = useMemo(() => {
    const orderCounts = new Map((topProducts ?? []).map((p) => [p.productId, p.orderCount]));
    return [...(profitByProduct ?? [])]
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => ({ ...p, orderCount: orderCounts.get(p.productId) ?? null }));
  }, [profitByProduct, topProducts]);

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Reports are available to owners, managers, and accountants only.</p>;
  }

  const topProductRows = productRows.slice(0, 10);
  const maxRevenue = Math.max(1, ...topProductRows.map((p) => p.revenue));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reports</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Sales, profit, and stock health for the selected period.</p>
      </div>

      {/* filter bar — one row, above everything it scopes */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-800" />
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass + " max-w-40"} />
          <span className="text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass + " max-w-40"} />
        </div>
      </div>

      {/* profit KPI cards */}
      {profit && (
        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Wallet size={17} />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(profit.revenue)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  <ShoppingCart size={17} />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Cost</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(profit.estimatedCost)}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50/40 p-5 shadow-sm dark:border-green-900/40 dark:bg-green-900/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                  {profit.estimatedProfit >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Profit</p>
              </div>
              <p
                className={`mt-3 text-2xl font-semibold tabular-nums ${
                  profit.estimatedProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(profit.estimatedProfit)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Profit is estimated using each product's current purchase price as a stand-in for historical cost — a rough margin read, not a
            financial-grade figure.
          </p>
        </div>
      )}

      {/* sales vs purchases trend */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <LineChart size={16} className="text-gray-400" />
          Sales vs Purchases
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {trendLoading ? <Loader /> : <SalesTrendChart data={trend ?? []} />}
        </div>
      </div>

      {/* product performance — revenue, orders, and margin in one place */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <BarChart3 size={16} className="text-gray-400" />
          Product Performance
        </h2>
        <p className="-mt-1 mb-2 text-xs text-gray-400 dark:text-gray-500">
          Ranked by revenue. Cost and margin use each product's current purchase price, not historical cost.
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {topProductRows.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No sales in this date range.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Revenue</th>
                  <th className="px-4 py-2 text-right font-medium">Orders</th>
                  <th className="px-4 py-2 text-right font-medium">Est. Cost</th>
                  <th className="px-4 py-2 text-right font-medium">Est. Profit</th>
                  <th className="px-4 py-2 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {topProductRows.map((p) => (
                  <tr key={p.productId}>
                    <td className="max-w-40 truncate px-4 py-2.5 text-gray-900 dark:text-gray-100" title={p.name}>
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                            style={{ width: `${Math.max(4, (p.revenue / maxRevenue) * 100)}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(p.revenue)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 dark:text-gray-500">{p.orderCount ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatCurrency(p.estimatedCost)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                        p.estimatedProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatCurrency(p.estimatedProfit)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${marginBadgeClass(p.marginPercent)}`}>
                        {p.marginPercent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {productRows.length > topProductRows.length && (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
              Showing top {topProductRows.length} of {productRows.length} products by revenue.
            </p>
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
