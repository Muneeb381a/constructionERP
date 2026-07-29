import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  HandCoins,
  Landmark,
  MessageCircle,
  PackagePlus,
  Plus,
  ShoppingCart,
  Trophy,
  Truck,
  Wallet,
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { PartyPicker } from "../components/PartyPicker";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { buildLowStockAlertMessage, buildWhatsAppShareLink } from "../lib/whatsapp";
import { isReminderDue } from "../lib/reminders";
import { useSendReminder } from "../hooks/useSendReminder";
import { useAuthStore } from "../store/authStore";
import { getTopCustomers, type Party } from "../lib/api/parties";
import { createPayment, listPartyBills, type CreatePaymentInput } from "../lib/api/payments";
import { getAgingReport } from "../lib/api/reports";
import { getMyTenant } from "../lib/api/tenants";
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

function RecordPaymentModal({ onClose, onRecorded }: { onClose: () => void; onRecorded: () => void }) {
  const [party, setParty] = useState<Party | null>(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "cheque">("cash");
  const [amount, setAmount] = useState(0);
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: bills } = useQuery({
    queryKey: ["party-bills", party?.id],
    queryFn: () => listPartyBills(party!.id),
    enabled: !!party,
  });
  const openBills = (bills ?? []).filter((b) => b.status === "unpaid" || b.status === "partial");

  const mutation = useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    onSuccess: onRecorded,
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to record payment"),
  });

  function selectParty(p: Party | null) {
    setParty(p);
    setInvoiceId("");
    setAmount(0);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Customer</label>
        <PartyPicker type="customer" placeholder="Search customer…" selected={party} onSelect={selectParty} onClear={() => selectParty(null)} />
      </div>

      {party && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({
              idempotencyKey: crypto.randomUUID(),
              partyId: party.id,
              invoiceId: invoiceId || null,
              method,
              amount,
              cheque: method === "cheque" ? { chequeNo, bankName: bankName || null, dueDate } : undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Apply to Bill</label>
            <select
              value={invoiceId}
              onChange={(e) => {
                const value = e.target.value;
                setInvoiceId(value);
                const bill = openBills.find((b) => b.invoice.id === value);
                if (bill) setAmount(Math.round(bill.balanceDue * 100) / 100);
              }}
              className={inputClass}
            >
              <option value="">On Account (no specific bill)</option>
              {openBills.map((b) => (
                <option key={b.invoice.id} value={b.invoice.id}>
                  {b.invoice.invoiceNo} — Balance {formatCurrency(b.balanceDue)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputClass}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
          </div>
          {method === "cheque" && (
            <>
              <div>
                <label className={labelClass}>Cheque No</label>
                <input required value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Bank Name</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canViewDashboard = role === "owner" || role === "manager" || role === "accountant";

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { sendReminder, loadingId: reminderLoadingId } = useSendReminder();

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

  const { data: aging } = useQuery({
    queryKey: ["reports-aging", "customer"],
    queryFn: () => getAgingReport("customer"),
    enabled: canViewDashboard,
  });
  const topDebtors = (aging ?? []).slice(0, 5);

  const { data: tenant } = useQuery({ queryKey: ["tenant"], queryFn: getMyTenant, enabled: canViewDashboard });
  const reminderIntervalDays = tenant?.reminderIntervalDays ?? 7;

  if (!canViewDashboard) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.restricted")}</p>;
  }

  if (isLoading) return <Loader full label={t("dashboard.loading")} />;
  if (isError || !data) return <p className="text-sm text-red-600 dark:text-red-400">{t("dashboard.loadFailed")}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.today")}</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* quick actions — the two things done most often at the counter, front and center */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          to="/sale"
          className="flex items-center gap-3 rounded-xl bg-blue-600 p-4 text-white shadow-sm transition hover:bg-blue-700"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Plus size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold">New Sale</p>
            <p className="text-xs text-blue-100">Create a bill</p>
          </div>
        </Link>

        <button
          onClick={() => setShowPaymentModal(true)}
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-green-300 hover:bg-green-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-green-900/10"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-500/10">
            <Banknote size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Record Payment</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Against any customer's bill</p>
          </div>
        </button>

        <Link
          to="/purchase"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-orange-900/10"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-500/10">
            <Truck size={20} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Purchase</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Record a supplier bill</p>
          </div>
        </Link>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* low stock — minimal: a count and a few names, not a full table (see /stock for that) */}
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
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("dashboard.noLowStock")}</p>
            ) : (
              <>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {data.lowStock.length} {data.lowStock.length === 1 ? "item" : "items"}
                </p>
                <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">below their minimum stock level</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.lowStock.slice(0, 5).map((item) => (
                    <span
                      key={item.productId}
                      className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      {item.name}
                    </span>
                  ))}
                  {data.lowStock.length > 5 && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      +{data.lowStock.length - 5} more
                    </span>
                  )}
                </div>
                <Link to="/stock" className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
                  View full stock →
                </Link>
              </>
            )}
          </div>
        </div>

        {/* customers with most outstanding */}
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <HandCoins size={15} className="text-red-500" />
            Customers with Most Outstanding
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {topDebtors.length === 0 ? (
              <p className="p-3 text-sm text-gray-500 dark:text-gray-400">No outstanding balances.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {topDebtors.map((row) => {
                  const due = isReminderDue(row.lastReminderSentAt, reminderIntervalDays);
                  return (
                    <li key={row.partyId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link to={`/customers/${row.partyId}`} className="truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                          {row.partyName}
                        </Link>
                        {due && (
                          <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            Due
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.total)}</span>
                        {row.phone && (
                          <button
                            type="button"
                            onClick={() => sendReminder({ id: row.partyId, name: row.partyName, phone: row.phone! }, row.total)}
                            disabled={reminderLoadingId === row.partyId}
                            title="Send WhatsApp reminder"
                            className="text-green-600 hover:text-green-700 disabled:opacity-50 dark:text-green-400"
                          >
                            <MessageCircle size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
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

      {showPaymentModal && (
        <Modal title="Record Payment" size="lg" onClose={() => setShowPaymentModal(false)}>
          <RecordPaymentModal
            onClose={() => setShowPaymentModal(false)}
            onRecorded={() => {
              setShowPaymentModal(false);
              queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
              queryClient.invalidateQueries({ queryKey: ["reports-aging"] });
              queryClient.invalidateQueries({ queryKey: ["top-customers"] });
            }}
          />
        </Modal>
      )}
    </div>
  );
}
