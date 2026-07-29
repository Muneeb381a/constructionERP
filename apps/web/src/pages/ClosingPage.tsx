import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Wallet } from "lucide-react";
import { Loader } from "../components/Loader";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { createClosing, getTodayClosingPreview, listClosings, type DailyClosing } from "../lib/api/closing";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function DiscrepancyBadge({ amount }: { amount: number }) {
  if (Math.abs(amount) <= 0.5) {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
        Matched
      </span>
    );
  }
  const short = amount < 0;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        short
          ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      }`}
    >
      {short ? `Short ${formatCurrency(Math.abs(amount))}` : `Over ${formatCurrency(amount)}`}
    </span>
  );
}

export function ClosingPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canView = role === "owner" || role === "manager";

  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["closing-today"],
    queryFn: getTodayClosingPreview,
    enabled: canView,
  });

  const { data: history } = useQuery({ queryKey: ["closing-history"], queryFn: listClosings, enabled: canView });

  const mutation = useMutation({
    mutationFn: () => createClosing({ countedCash: Number(countedCash), notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closing-today"] });
      queryClient.invalidateQueries({ queryKey: ["closing-history"] });
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to close today"),
  });

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Day-End Closing is available to owners and managers only.</p>;
  }

  if (isLoading || !preview) return <Loader full />;

  const closed = preview.alreadyClosed ? preview.existingClosing : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <ClipboardCheck size={18} className="text-gray-400" />
          Day-End Closing
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {new Date(preview.closingDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="rounded-2xl bg-linear-to-br from-blue-600 to-blue-800 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
            <Wallet size={20} />
          </div>
          <p className="text-sm font-medium text-white/80">Expected Cash in Drawer</p>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight">{formatCurrency(preview.expectedCash)}</p>
        <p className="mt-1 text-xs text-white/70">Cash Book balance + today's cash sales/payments. Walk-in sales are assumed cash.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Figures</h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <StatRow label={`Sales (${preview.salesCount})`} value={formatCurrency(preview.salesTotal)} />
          <StatRow label="Purchases" value={formatCurrency(preview.purchasesTotal)} />
          <StatRow label="Cash Collected" value={formatCurrency(preview.cashCollected)} />
          <StatRow label="Bank Transfer Collected" value={formatCurrency(preview.bankCollected)} />
          <StatRow label="Cheques Collected" value={formatCurrency(preview.chequeCollected)} />
          <StatRow label="Expenses" value={formatCurrency(preview.expensesTotal)} />
        </div>
      </div>

      {closed ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 size={18} />
            <h2 className="text-sm font-semibold">Today is closed</h2>
          </div>
          <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            <StatRow label="Expected Cash" value={formatCurrency(Number(closed.expectedCash))} />
            <StatRow label="Counted Cash" value={formatCurrency(Number(closed.countedCash))} />
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Discrepancy</span>
              <DiscrepancyBadge amount={Number(closed.discrepancy)} />
            </div>
          </div>
          {closed.notes && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{closed.notes}</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Count the Drawer</h2>
          <div>
            <label className={labelClass}>Actual Cash Counted</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>
          <div className="mt-3">
            <label className={labelClass}>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="e.g. Rs 500 short, cashier says…" />
          </div>

          {countedCash !== "" && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Difference: <DiscrepancyBadge amount={Number(countedCash) - preview.expectedCash} />
            </p>
          )}

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={countedCash === "" || mutation.isPending}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? "Closing…" : "Close Today"}
          </button>
        </div>
      )}

      {history && history.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">History</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Sales</th>
                  <th className="px-4 py-2 font-medium">Expected</th>
                  <th className="px-4 py-2 font-medium">Counted</th>
                  <th className="px-4 py-2 font-medium">Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((c: DailyClosing) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(c.closingDate + "T00:00:00").toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(c.salesTotal))}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(c.expectedCash))}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(c.countedCash))}</td>
                    <td className="px-4 py-2">
                      <DiscrepancyBadge amount={Number(c.discrepancy)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
