import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookText, ChevronRight, MessageCircle } from "lucide-react";
import { Loader } from "../components/Loader";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { buildBillReminderMessage, buildWhatsAppLink } from "../lib/whatsapp";
import { useAuthStore } from "../store/authStore";
import { getAgingReport, type AgingRow } from "../lib/api/reports";
import { listPartyBills } from "../lib/api/payments";

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
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <BookText size={18} className="text-gray-400" />
          Ledger
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Who owes you, and who you owe. Tap a name for their full history.</p>
      </div>

      <div className="flex items-center gap-1 self-start rounded-md border border-gray-300 p-0.5 dark:border-gray-700">
        <button
          onClick={() => setPartyType("customer")}
          className={`rounded px-4 py-1.5 text-sm font-medium ${
            partyType === "customer" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          Customers
        </button>
        <button
          onClick={() => setPartyType("supplier")}
          className={`rounded px-4 py-1.5 text-sm font-medium ${
            partyType === "supplier" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          Suppliers
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {partyType === "customer" ? "Total owed to you" : "Total you owe"}
        </p>
        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</p>
      </div>

      <input
        placeholder={`Search ${partyType}s…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputClass}
      />

      {isLoading ? (
        <Loader />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {search ? "No match." : `No ${partyType} has an outstanding balance right now.`}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <li key={row.partyId} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/customers/${row.partyId}`} className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="truncate font-medium text-gray-900 dark:text-gray-100">{row.partyName}</span>
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
