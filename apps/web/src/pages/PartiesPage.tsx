import { useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageCircle, Pencil, Plus, ShoppingBag, Trash2, Truck, User, Phone, MapPin, IdCard, Wallet } from "lucide-react";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useSendReminder } from "../hooks/useSendReminder";
import { useAuthStore } from "../store/authStore";
import { createParty, deleteParty, listParties, updateParty, type Party, type PartyInput } from "../lib/api/parties";

const emptyForm: PartyInput = { type: "customer", name: "", phone: "", cnic: "", address: "", creditLimit: 0 };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PartyAvatar({ name, type }: { name: string; type: "customer" | "supplier" }) {
  const isCustomer = type === "customer";
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isCustomer
          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
          : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
      }`}
    >
      {initials(name)}
    </div>
  );
}

function FieldWithIcon({ icon: Icon, children }: { icon: ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="relative mt-1">
      <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      {children}
    </div>
  );
}

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
  const [openingAmount, setOpeningAmount] = useState(0);
  const [openingDirection, setOpeningDirection] = useState<"debit" | "credit">("debit");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          openingBalance: !isEdit && openingAmount > 0 ? { direction: openingDirection, amount: openingAmount } : undefined,
        });
      }}
      className="space-y-5"
    >
      <div>
        <label className={labelClass}>Type</label>
        <div className={`mt-1 grid grid-cols-2 gap-2 ${isEdit ? "opacity-60" : ""}`}>
          <button
            type="button"
            disabled={isEdit}
            onClick={() => setForm({ ...form, type: "customer" })}
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              form.type === "customer"
                ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <ShoppingBag size={15} />
            Customer
          </button>
          <button
            type="button"
            disabled={isEdit}
            onClick={() => setForm({ ...form, type: "supplier" })}
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              form.type === "supplier"
                ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
                : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            <Truck size={15} />
            Supplier
          </button>
        </div>
        {isEdit && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Type can't be changed after creation.</p>}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Basic Info</p>
        <div>
          <label className={labelClass}>Name</label>
          <FieldWithIcon icon={User}>
            <input
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass + " mt-0 pl-9"}
              placeholder="e.g. Ahmed Traders"
            />
          </FieldWithIcon>
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <FieldWithIcon icon={Phone}>
            <input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass + " mt-0 pl-9"}
              placeholder="03xx-xxxxxxx"
            />
          </FieldWithIcon>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Additional Details</p>
        <div>
          <label className={labelClass}>CNIC</label>
          <FieldWithIcon icon={IdCard}>
            <input
              value={form.cnic ?? ""}
              onChange={(e) => setForm({ ...form, cnic: e.target.value })}
              className={inputClass + " mt-0 pl-9"}
              placeholder="xxxxx-xxxxxxx-x"
            />
          </FieldWithIcon>
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <FieldWithIcon icon={MapPin}>
            <input
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputClass + " mt-0 pl-9"}
            />
          </FieldWithIcon>
        </div>
      </div>

      {canSetCreditLimit && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Credit Limit</p>
          <FieldWithIcon icon={Wallet}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: Math.max(0, Number(e.target.value)) })}
              className={inputClass + " mt-0 pl-9"}
            />
          </FieldWithIcon>
        </div>
      )}

      {!isEdit && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Opening Balance <span className="normal-case text-gray-400">(pichla baqaya, optional)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <FieldWithIcon icon={Wallet}>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={openingAmount || ""}
                onChange={(e) => setOpeningAmount(Math.max(0, Number(e.target.value)))}
                className={inputClass + " mt-0 pl-9"}
              />
            </FieldWithIcon>
            <select
              value={openingDirection}
              onChange={(e) => setOpeningDirection(e.target.value as "debit" | "credit")}
              className={inputClass + " mt-0"}
            >
              <option value="debit">{form.type === "customer" ? "Customer owes this" : "We owe supplier this"}</option>
              <option value="credit">{form.type === "customer" ? "We owe customer (advance)" : "Supplier owes us (advance)"}</option>
            </select>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Whatever this {form.type} already owed (or was owed) before you started using this system — posted straight
            to their ledger so their balance and future payments line up from day one.
          </p>
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
  const [modal, setModal] = useState<
    null | { mode: "create" } | { mode: "edit"; party: Party } | { mode: "delete"; party: Party }
  >(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { sendReminder, loadingId: reminderLoadingId } = useSendReminder();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["parties", search, typeFilter],
    queryFn: () => listParties({ search: search || undefined, type: typeFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: createParty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setModal(null);
    },
    onError: (err) => setFormError(axiosErrorMessage(err) ?? "Failed to save customer"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PartyInput> }) => updateParty(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setModal(null);
    },
    onError: (err) => setFormError(axiosErrorMessage(err) ?? "Failed to save customer"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteParty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      setModal(null);
    },
    onError: (err) => setDeleteError(axiosErrorMessage(err) ?? "Failed to delete customer"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {data ? `${data.total} ${data.total === 1 ? "record" : "records"}` : " "}
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setModal({ mode: "create" });
          }}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass + " max-w-sm"}
        />
        <div className="flex items-center gap-1 rounded-md border border-gray-300 p-0.5 dark:border-gray-700">
          {(["", "customer", "supplier"] as const).map((opt) => (
            <button
              key={opt || "all"}
              onClick={() => setTypeFilter(opt)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                typeFilter === opt ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {opt || "All"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load customers. Try refreshing.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Balance</th>
                <th className="px-4 py-2.5 font-medium">Credit Limit</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.data.map((party) => {
                const balance = Number(party.cachedBalance);
                return (
                  <tr key={party.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/customers/${party.id}`} className="flex items-center gap-3">
                        <PartyAvatar name={party.name} type={party.type} />
                        <span className="font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400">
                          {party.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-gray-500 dark:text-gray-400">{party.type}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{party.phone ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {balance > 0.01 ? (
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(balance)}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Settled</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {Number(party.creditLimit) > 0 ? formatCurrency(Number(party.creditLimit)) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {party.phone && balance > 0.01 && (
                          <button
                            type="button"
                            onClick={() => sendReminder({ id: party.id, name: party.name, phone: party.phone! }, balance)}
                            disabled={reminderLoadingId === party.id}
                            title="Send WhatsApp reminder"
                            className="text-green-600 hover:text-green-700 disabled:opacity-50 dark:text-green-400"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setFormError(null);
                            setModal({ mode: "edit", party });
                          }}
                          title="Edit"
                          className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
                        >
                          <Pencil size={15} />
                        </button>
                        {canSetCreditLimit && (
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setModal({ mode: "delete", party });
                            }}
                            title="Delete"
                            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === "create" && (
        <Modal title="Add Customer" size="lg" onClose={() => setModal(null)}>
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
        <Modal title="Edit Customer" size="lg" onClose={() => setModal(null)}>
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

      {modal?.mode === "delete" && (
        <ConfirmDialog
          title="Delete Customer"
          message={`"${modal.party.name}" will be permanently removed. This only works if they have no invoices, payments, or ledger history — otherwise it'll fail and you should edit their record instead.`}
          confirmLabel="Delete"
          pending={deleteMutation.isPending}
          error={deleteError}
          onCancel={() => setModal(null)}
          onConfirm={() => deleteMutation.mutate(modal.party.id)}
        />
      )}
    </div>
  );
}
