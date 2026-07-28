import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookText } from "lucide-react";
import { Loader } from "../components/Loader";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listAllLedger } from "../lib/api/ledger";

export function LedgerPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canView = role === "owner" || role === "manager" || role === "accountant";

  const [search, setSearch] = useState("");
  const [partyType, setPartyType] = useState<"" | "customer" | "supplier">("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["ledger-all", search, partyType, page],
    queryFn: () => listAllLedger({ search: search || undefined, partyType: partyType || undefined, page }),
    enabled: canView,
  });

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Ledger is available to owners, managers, and accountants only.</p>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <BookText size={18} className="text-gray-400" />
          Ledger
        </h1>
      </div>
      <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">
        Every posting across every customer and supplier — invoices, payments, opening balances, and adjustments. For one party's own
        running balance, open that party's page instead.
      </p>

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search customer or supplier…"
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
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Party</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Direction</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <Link to={`/customers/${entry.partyId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {entry.partyName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 capitalize text-gray-500 dark:text-gray-400">{entry.partyType}</td>
                    <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{entry.sourceType.replace("_", " ")}</td>
                    <td className="px-4 py-2">
                      <span className={entry.direction === "debit" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                        {entry.direction === "debit" ? "Debit (owes more)" : "Credit (owes less)"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(entry.amount))}</td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No ledger entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
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
  );
}
