import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, BookText } from "lucide-react";
import { Loader } from "../components/Loader";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listAllLedger } from "../lib/api/ledger";
import { listParties } from "../lib/api/parties";

function RecentActivity() {
  const { data, isLoading } = useQuery({ queryKey: ["ledger-recent"], queryFn: () => listAllLedger({ page: 1 }) });
  const recent = (data?.data ?? []).slice(0, 6);

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <Loader />
        ) : recent.length === 0 ? (
          <p className="p-3 text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link to={`/customers/${entry.partyId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    {entry.partyName}
                  </Link>
                  <p className="text-xs capitalize text-gray-400 dark:text-gray-500">
                    {entry.sourceType.replace("_", " ")} · {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={entry.direction === "debit" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                  {entry.direction === "debit" ? "+" : "−"}
                  {formatCurrency(Number(entry.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LedgerPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canView = role === "owner" || role === "manager" || role === "accountant";

  const [search, setSearch] = useState("");
  const [partyType, setPartyType] = useState<"" | "customer" | "supplier">("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["parties", search, partyType, "balance", page],
    queryFn: () => listParties({ search: search || undefined, type: partyType || undefined, sort: "balance", page }),
    enabled: canView,
  });

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Ledger is available to owners, managers, and accountants only.</p>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <BookText size={18} className="text-gray-400" />
          Ledger
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Every customer and supplier's running balance, biggest first. Open one to see their full invoices, payments, and history.
        </p>
      </div>

      <RecentActivity />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">By Customer / Supplier</h2>

        <div className="mb-3 flex flex-wrap gap-3">
          <input
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={inputClass + " max-w-sm"}
          />
          <select
            value={partyType}
            onChange={(e) => {
              setPartyType(e.target.value as typeof partyType);
              setPage(1);
            }}
            className={inputClass + " max-w-40"}
          >
            <option value="">All Parties</option>
            <option value="customer">Customers</option>
            <option value="supplier">Suppliers</option>
          </select>
        </div>

        {isLoading ? (
          <Loader />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Balance</th>
                    <th className="px-4 py-2 font-medium">Last Activity</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data?.data.map((party) => {
                    const balance = Number(party.cachedBalance);
                    const balanceLabel = balance <= 0.01 ? "Settled" : party.type === "customer" ? "Owed to you" : "You owe";
                    return (
                      <tr key={party.id}>
                        <td className="px-4 py-2">
                          <Link to={`/customers/${party.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                            {party.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 capitalize text-gray-500 dark:text-gray-400">{party.type}</td>
                        <td className="px-4 py-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(balance)}</span>
                          <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{balanceLabel}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                          {party.balanceUpdatedAt ? new Date(party.balanceUpdatedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            to={`/customers/${party.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            View statement
                            <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                        No customers or suppliers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                Page {data?.page ?? 1} of {totalPages} · {data?.total ?? 0} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
