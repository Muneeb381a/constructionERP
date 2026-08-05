import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { useShopContext } from "../hooks/useShopContext";
import { createCashBookEntry, getCashBookBalance, listCashBookEntries } from "../lib/api/cashbook";

function AddEntryForm({ branchId, onDone }: { branchId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const mutation = useMutation({
    mutationFn: () => createCashBookEntry({ idempotencyKey, branchId, direction, amount, description: description || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-book"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book-balance"] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to add entry"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Direction</label>
        <select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} className={inputClass}>
          <option value="debit">Cash In</option>
          <option value="credit">Cash Out</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. Opening till float, petty cash…" />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Add Entry"}
        </button>
      </div>
    </form>
  );
}

export function CashBookPage() {
  const user = useAuthStore((s) => s.user);
  const canView = user?.role === "owner" || user?.role === "manager" || user?.role === "accountant";
  const canAdd = user?.role === "owner" || user?.role === "manager";

  const shop = useShopContext();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: balance } = useQuery({
    queryKey: ["cash-book-balance", shop.branchId],
    queryFn: () => getCashBookBalance(shop.branchId),
    enabled: canView && !!shop.branchId,
  });

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ["cash-book", shop.branchId, page],
    queryFn: () => listCashBookEntries({ branchId: shop.branchId, page }),
    enabled: canView && !!shop.branchId,
  });

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Cash book is available to owners, managers, and accountants only.</p>;
  }

  const totalPages = entries ? Math.max(1, Math.ceil(entries.total / entries.limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cash Book</h1>
        {canAdd && (
          <button onClick={() => setShowAddModal(true)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add Entry
          </button>
        )}
      </div>

      {balance && (
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Cash in Hand</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(balance.balance)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load cash book entries. Try refreshing.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Direction</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries?.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{entry.description ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={entry.direction === "debit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {entry.direction === "debit" ? "Cash In" : "Cash Out"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(entry.amount))}</td>
                  </tr>
                ))}
                {entries?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No cash book entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              Page {entries?.page ?? 1} of {totalPages} · {entries?.total ?? 0} total
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <Modal title="Add Cash Book Entry" onClose={() => setShowAddModal(false)}>
          <AddEntryForm branchId={shop.branchId} onDone={() => setShowAddModal(false)} />
        </Modal>
      )}
    </div>
  );
}
