import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { useShopContext } from "../hooks/useShopContext";
import { createExpense, getExpenseCategorySummary, listExpenses, type ExpenseInput } from "../lib/api/expenses";

const COMMON_CATEGORIES = ["Rent", "Utilities", "Fuel", "Maintenance", "Office Supplies", "Miscellaneous"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AddExpenseForm({ branchId, onDone }: { branchId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExpenseInput>({
    branchId,
    category: "",
    amount: 0,
    description: "",
    method: "cash",
    expenseDate: todayIso(),
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createExpense({ ...form, branchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-category-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book"] });
      queryClient.invalidateQueries({ queryKey: ["cash-book-balance"] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to record expense"),
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
        <label className={labelClass}>Category</label>
        <input
          required
          list="expense-categories"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Rent, Utilities, Fuel…"
          className={inputClass}
        />
        <datalist id="expense-categories">
          {COMMON_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Amount</label>
          <input type="number" step="0.01" min="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" required value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Method</label>
        <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as ExpenseInput["method"] })} className={inputClass}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Record Expense"}
        </button>
      </div>
    </form>
  );
}

export function ExpensesPage() {
  const user = useAuthStore((s) => s.user);
  const canAdd = user?.role === "owner" || user?.role === "manager";

  const shop = useShopContext();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", shop.branchId, page],
    queryFn: () => listExpenses({ branchId: shop.branchId, page }),
    enabled: !!shop.branchId,
  });

  const { data: categorySummary } = useQuery({
    queryKey: ["expense-category-summary"],
    queryFn: () => getExpenseCategorySummary(),
  });

  const totalPages = expenses ? Math.max(1, Math.ceil(expenses.total / expenses.limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Expenses</h1>
        {canAdd && (
          <button onClick={() => setShowAddModal(true)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Record Expense
          </button>
        )}
      </div>

      {categorySummary && categorySummary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categorySummary.map((row) => (
            <div key={row.category} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">{row.category}</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(Number(row.total))}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {expenses?.data.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{exp.expenseDate}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{exp.category}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{exp.description ?? "—"}</td>
                    <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{exp.method.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(exp.amount))}</td>
                  </tr>
                ))}
                {expenses?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No expenses recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
              {expenses && expenses.data.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 font-medium dark:border-gray-800">
                    <td colSpan={4} className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                      Total (all matching)
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(expenses.totalAmount))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              Page {expenses?.page ?? 1} of {totalPages} · {expenses?.total ?? 0} total
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
        <Modal title="Record Expense" onClose={() => setShowAddModal(false)}>
          <AddExpenseForm branchId={shop.branchId} onDone={() => setShowAddModal(false)} />
        </Modal>
      )}
    </div>
  );
}
