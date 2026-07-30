import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Loader } from "../components/Loader";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listChequeRegister, updateChequeStatus } from "../lib/api/payments";

type StatusFilter = "all" | "pending" | "cleared" | "bounced";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "cleared", label: "Cleared" },
  { key: "bounced", label: "Bounced" },
];

function DueBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status !== "pending") return null;
  const daysLeft = Math.floor((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) {
    return (
      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        Overdue
      </span>
    );
  }
  if (daysLeft <= 7) {
    return (
      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        Due Soon
      </span>
    );
  }
  return null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  cleared: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  bounced: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function ChequesPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === "owner" || role === "manager" || role === "accountant";
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const { data: cheques, isLoading } = useQuery({
    queryKey: ["cheque-register", filter],
    queryFn: () => listChequeRegister(filter === "all" ? {} : { status: filter }),
    enabled: canManage,
  });

  const mutation = useMutation({
    mutationFn: ({ chequeId, status }: { chequeId: string; status: "cleared" | "bounced" }) => updateChequeStatus(chequeId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cheque-register"] }),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to update cheque"),
  });

  if (!canManage) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Cheque Register is available to owners, managers, and accountants only.</p>;
  }

  const dueSoonOrOverdue = (cheques ?? []).filter(
    (c) => c.status === "pending" && new Date(c.dueDate).getTime() - Date.now() <= 7 * 86_400_000,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Landmark size={18} className="text-gray-400" />
          Cheque Register
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Every post-dated cheque received from a customer or issued to a supplier, in one place.
        </p>
      </div>

      {dueSoonOrOverdue > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {dueSoonOrOverdue} cheque{dueSoonOrOverdue === 1 ? " is" : "s are"} overdue or due within 7 days.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f.key
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <Loader />
        ) : !cheques || cheques.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No cheques on record.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Due Date</th>
                <th className="px-4 py-2 font-medium">Party</th>
                <th className="px-4 py-2 font-medium">Cheque No</th>
                <th className="px-4 py-2 font-medium">Bank</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cheques.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                    {new Date(c.dueDate).toLocaleDateString()}
                    <DueBadge dueDate={c.dueDate} status={c.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/customers/${c.partyId}`} className="text-blue-600 hover:underline dark:text-blue-400">
                      {c.partyName}
                    </Link>
                    <span className="ml-1.5 text-xs capitalize text-gray-400">({c.partyType})</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.chequeNo}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.bankName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(c.amount))}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setError(null);
                            mutation.mutate({ chequeId: c.id, status: "cleared" });
                          }}
                          className="text-green-600 hover:underline dark:text-green-400"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => {
                            setError(null);
                            mutation.mutate({ chequeId: c.id, status: "bounced" });
                          }}
                          className="text-red-600 hover:underline dark:text-red-400"
                        >
                          Bounce
                        </button>
                      </div>
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
