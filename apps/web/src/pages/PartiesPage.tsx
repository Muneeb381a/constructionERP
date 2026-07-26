import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Modal } from "../components/Modal";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { buildBalanceReminderMessage, buildWhatsAppLink } from "../lib/whatsapp";
import { useAuthStore } from "../store/authStore";
import { createParty, listParties, updateParty, type Party, type PartyInput } from "../lib/api/parties";

const emptyForm: PartyInput = { type: "customer", name: "", phone: "", cnic: "", address: "", creditLimit: 0 };

function PartyForm({
  initial,
  isEdit,
  canSetCreditLimit,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial: PartyInput;
  isEdit: boolean;
  canSetCreditLimit: boolean;
  onSubmit: (input: PartyInput) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Type</label>
        <select
          disabled={isEdit}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as "customer" | "supplier" })}
          className={inputClass + (isEdit ? " opacity-60" : "")}
        >
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
        </select>
        {isEdit && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Party type can't be changed after creation.</p>}
      </div>
      <div>
        <label className={labelClass}>Name</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>CNIC</label>
        <input value={form.cnic ?? ""} onChange={(e) => setForm({ ...form, cnic: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Address</label>
        <input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} />
      </div>
      {canSetCreditLimit && (
        <div>
          <label className={labelClass}>Credit Limit</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function PartiesPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canSetCreditLimit = role === "owner" || role === "manager";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "customer" | "supplier">("");
  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; party: Party }>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["parties", search, typeFilter],
    queryFn: () => listParties({ search: search || undefined, type: typeFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: createParty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setModal(null);
    },
    onError: (err) => setFormError(axiosErrorMessage(err) ?? "Failed to save party"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PartyInput> }) => updateParty(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setModal(null);
    },
    onError: (err) => setFormError(axiosErrorMessage(err) ?? "Failed to save party"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Parties</h1>
        <button
          onClick={() => {
            setFormError(null);
            setModal({ mode: "create" });
          }}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Party
        </button>
      </div>

      <div className="flex gap-3">
        <input
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass + " max-w-sm"}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={inputClass + " max-w-40"}>
          <option value="">All</option>
          <option value="customer">Customers</option>
          <option value="supplier">Suppliers</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Balance</th>
                <th className="px-4 py-2 font-medium">Credit Limit</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.data.map((party) => (
                <tr key={party.id}>
                  <td className="px-4 py-2">
                    <Link to={`/parties/${party.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                      {party.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{party.type}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{party.phone ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(party.cachedBalance))}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(party.creditLimit))}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {party.phone && Number(party.cachedBalance) > 0 && (
                        <a
                          href={buildWhatsAppLink(
                            party.phone,
                            buildBalanceReminderMessage(party.name, formatCurrency(Number(party.cachedBalance))),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send WhatsApp reminder"
                          className="text-green-600 hover:text-green-700 dark:text-green-400"
                        >
                          <MessageCircle size={16} />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setFormError(null);
                          setModal({ mode: "edit", party });
                        }}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No parties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === "create" && (
        <Modal title="Add Party" onClose={() => setModal(null)}>
          <PartyForm
            initial={emptyForm}
            isEdit={false}
            canSetCreditLimit={canSetCreditLimit}
            submitting={createMutation.isPending}
            error={formError}
            onCancel={() => setModal(null)}
            onSubmit={(input) => createMutation.mutate(input)}
          />
        </Modal>
      )}

      {modal?.mode === "edit" && (
        <Modal title="Edit Party" onClose={() => setModal(null)}>
          <PartyForm
            initial={{
              type: modal.party.type,
              name: modal.party.name,
              phone: modal.party.phone,
              cnic: modal.party.cnic,
              address: modal.party.address,
              creditLimit: Number(modal.party.creditLimit),
            }}
            isEdit={true}
            canSetCreditLimit={canSetCreditLimit}
            submitting={updateMutation.isPending}
            error={formError}
            onCancel={() => setModal(null)}
            onSubmit={(input) => updateMutation.mutate({ id: modal.party.id, input })}
          />
        </Modal>
      )}
    </div>
  );
}
