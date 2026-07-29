import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookText, ChevronRight, HandCoins, Landmark, MessageCircle, Search } from "lucide-react";
import { Loader } from "../components/Loader";
import { formatCurrency } from "../lib/format";
import { buildBillReminderMessage, buildWhatsAppLink } from "../lib/whatsapp";
import { useAuthStore } from "../store/authStore";
import { getAgingReport, type AgingRow } from "../lib/api/reports";
import { listPartyBills } from "../lib/api/payments";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LedgerPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canView = role === "owner" || role === "manager" || role === "accountant";

  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [search, setSearch] = useState("");
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reports-aging", partyType],
    queryFn: () => getAgingReport(partyType),
    enabled: canView,
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((r) => r.partyName.toLowerCase().includes(q));
  }, [data, search]);

  const grandTotal = (data ?? []).reduce((sum, r) => sum + r.total, 0);
  const isCustomer = partyType === "customer";

  async function sendReminder(row: AgingRow) {
    if (!row.phone) return;
    setReminderLoadingId(row.partyId);
    try {
      const bills = await listPartyBills(row.partyId);
      const message = buildBillReminderMessage(
        row.partyName,
        bills.map((b) => ({ invoiceNo: b.invoice.invoiceNo, date: b.invoice.createdAt, balanceDue: b.balanceDue })),
        formatCurrency(row.total),
      );
      window.open(buildWhatsAppLink(row.phone, message), "_blank", "noopener,noreferrer");
    } finally {
      setReminderLoadingId(null);
    }
  }

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Ledger is available to owners, managers, and accountants only.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <BookText size={18} className="text-gray-400" />
          Ledger
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Who owes you, and who you owe. Tap a name for their full history.</p>
      </div>

      {/* summary hero */}
      <div
        className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-sm ${
          isCustomer ? "bg-linear-to-br from-blue-600 to-blue-800" : "bg-linear-to-br from-orange-500 to-orange-700"
        }`}
      >
        <div className="pointer-events-none absolute -right-6 -top-6 opacity-10">
          {isCustomer ? <HandCoins size={140} /> : <Landmark size={140} />}
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
            {isCustomer ? <HandCoins size={20} /> : <Landmark size={20} />}
          </div>
          <p className="text-sm font-medium text-white/80">{isCustomer ? "Total owed to you" : "Total you owe"}</p>
        </div>
        <p className="relative mt-3 text-4xl font-semibold tracking-tight">{formatCurrency(grandTotal)}</p>
        <p className="relative mt-1 text-sm text-white/70">
          Across {rows.length} {isCustomer ? "customer" : "supplier"}
          {rows.length === 1 ? "" : "s"} with a balance
        </p>

        {/* toggle, inset into the hero */}
        <div className="relative mt-5 inline-flex items-center gap-1 rounded-full bg-white/15 p-1 backdrop-blur-sm">
          <button
            onClick={() => setPartyType("customer")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isCustomer ? "bg-white text-blue-700" : "text-white/80 hover:text-white"
            }`}
          >
            Customers
          </button>
          <button
            onClick={() => setPartyType("supplier")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !isCustomer ? "bg-white text-orange-700" : "text-white/80 hover:text-white"
            }`}
          >
            Suppliers
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder={`Search ${partyType}s…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {search ? "No match." : `Nothing owed by any ${partyType} right now.`}
              </p>
              {!search && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Balances will appear here as bills go unpaid.</p>}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <li key={row.partyId} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Link to={`/customers/${row.partyId}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isCustomer
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                          : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                      }`}
                    >
                      {initials(row.partyName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                        {row.partyName}
                      </p>
                      {(row.d61to90 > 0 || row.d90plus > 0) && (
                        <p className="text-xs font-medium text-red-600 dark:text-red-400">60+ days overdue</p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.total)}</span>
                  </Link>
                  {row.phone && (
                    <button
                      type="button"
                      onClick={() => sendReminder(row)}
                      disabled={reminderLoadingId === row.partyId}
                      title="Send WhatsApp reminder"
                      className="shrink-0 text-green-600 hover:text-green-700 disabled:opacity-50 dark:text-green-400"
                    >
                      <MessageCircle size={16} />
                    </button>
                  )}
                  <Link to={`/customers/${row.partyId}`} className="shrink-0 text-gray-300 dark:text-gray-600">
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
