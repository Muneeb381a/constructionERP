import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Modal } from "../components/Modal";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { buildBalanceReminderMessage, buildWhatsAppLink } from "../lib/whatsapp";
import { useAuthStore } from "../store/authStore";
import { getParty, type Party } from "../lib/api/parties";
import { getPartyLedger, postLedgerAdjustment, postOpeningBalance } from "../lib/api/ledger";
import {
  createPayment,
  listPartyBills,
  listPartyPayments,
  updateChequeStatus,
  type CreatePaymentInput,
  type PartyBill,
} from "../lib/api/payments";
import { listInvoices } from "../lib/api/invoices";

const INVOICE_TYPE_LABELS: Record<string, string> = {
  sale: "Sale",
  purchase: "Purchase",
  sale_return: "Sale Return",
  purchase_return: "Purchase Return",
};

const BILL_STATUS_STYLES: Record<PartyBill["status"], string> = {
  paid: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  unpaid: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  void: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const BILL_STATUS_LABELS: Record<PartyBill["status"], string> = {
  paid: "Paid",
  partial: "Partially Paid",
  unpaid: "Unpaid",
  void: "Void",
};

function BillHistory({ party }: { party: Party }) {
  const partyId = party.id;
  const billType = party.type === "supplier" ? "purchase" : "sale";

  const { data, isLoading } = useQuery({
    queryKey: ["party-invoices", partyId],
    queryFn: () => listInvoices({ partyId, limit: 100 }),
  });

  const { data: bills } = useQuery({
    queryKey: ["party-bills", partyId],
    queryFn: () => listPartyBills(partyId),
  });

  const billByInvoiceId = new Map((bills ?? []).map((b) => [b.invoice.id, b]));

  const invoices = data?.data ?? [];
  const completed = invoices.filter((i) => i.type === billType && i.status !== "void");
  const orderCount = completed.length;
  const lifetimeValue = completed.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const avgOrder = orderCount > 0 ? lifetimeValue / orderCount : 0;
  const lastPurchase = completed[0]?.createdAt; // API already orders by createdAt desc
  const outstandingBills = (bills ?? []).filter((b) => b.status === "unpaid" || b.status === "partial").length;

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {party.type === "supplier" ? "Purchase History" : "Sales History"}
      </h2>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">{party.type === "supplier" ? "Purchases" : "Orders"}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{orderCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Lifetime Value</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(lifetimeValue)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Bill</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(avgOrder)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Last Bill</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {lastPurchase ? new Date(lastPurchase).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">Unsettled Bills</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{outstandingBills}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Balance Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv) => {
                const bill = billByInvoiceId.get(inv.id);
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-2">
                      <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(inv.totalAmount))}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{bill ? formatCurrency(bill.paidTotal) : "—"}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {bill ? formatCurrency(Math.max(0, bill.balanceDue)) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          bill ? BILL_STATUS_STYLES[bill.status] : BILL_STATUS_STYLES.void
                        }`}
                      >
                        {bill ? BILL_STATUS_LABELS[bill.status] : inv.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordPaymentForm({ partyId, onDone }: { partyId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "cheque">("cash");
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: bills } = useQuery({
    queryKey: ["party-bills", partyId],
    queryFn: () => listPartyBills(partyId),
  });
  const openBills = (bills ?? []).filter((b) => b.status === "unpaid" || b.status === "partial");

  const mutation = useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party", partyId] });
      queryClient.invalidateQueries({ queryKey: ["party-ledger", partyId] });
      queryClient.invalidateQueries({ queryKey: ["party-payments", partyId] });
      queryClient.invalidateQueries({ queryKey: ["party-bills", partyId] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to record payment"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({
          idempotencyKey: crypto.randomUUID(),
          partyId,
          invoiceId: invoiceId || null,
          method,
          amount,
          note: note || null,
          cheque: method === "cheque" ? { chequeNo, bankName: bankName || null, dueDate } : undefined,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Apply to Bill</label>
        <select
          value={invoiceId}
          onChange={(e) => {
            const value = e.target.value;
            setInvoiceId(value);
            const bill = openBills.find((b) => b.invoice.id === value);
            if (bill) setAmount(Math.round(bill.balanceDue * 100) / 100);
          }}
          className={inputClass}
        >
          <option value="">On Account (no specific bill)</option>
          {openBills.map((b) => (
            <option key={b.invoice.id} value={b.invoice.id}>
              {b.invoice.invoiceNo} — Balance {formatCurrency(b.balanceDue)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputClass}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </div>
      {method === "cheque" && (
        <>
          <div>
            <label className={labelClass}>Cheque No</label>
            <input required value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bank Name</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </>
      )}
      <div>
        <label className={labelClass}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Record Payment"}
        </button>
      </div>
    </form>
  );
}

function LedgerEntryForm({
  partyId,
  kind,
  onDone,
}: {
  partyId: string;
  kind: "opening-balance" | "adjustment";
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      kind === "opening-balance" ? postOpeningBalance(partyId, { direction, amount }) : postLedgerAdjustment(partyId, { direction, amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party", partyId] });
      queryClient.invalidateQueries({ queryKey: ["party-ledger", partyId] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to post entry"),
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
          <option value="debit">Debit (increases balance owed)</option>
          <option value="credit">Credit (decreases balance owed)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Post"}
        </button>
      </div>
    </form>
  );
}

export function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canManageLedger = role === "owner" || role === "manager";
  const canManageCheques = role === "owner" || role === "manager" || role === "accountant";

  const [modal, setModal] = useState<null | "payment" | "opening-balance" | "adjustment">(null);
  const [chequeError, setChequeError] = useState<string | null>(null);

  const { data: party, isLoading: partyLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: () => getParty(id!),
    enabled: !!id,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["party-ledger", id],
    queryFn: () => getPartyLedger(id!),
    enabled: !!id,
  });

  const { data: paymentsList } = useQuery({
    queryKey: ["party-payments", id],
    queryFn: () => listPartyPayments(id!),
    enabled: !!id,
  });

  const chequeMutation = useMutation({
    mutationFn: ({ chequeId, status }: { chequeId: string; status: "cleared" | "bounced" }) => updateChequeStatus(chequeId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party", id] });
      queryClient.invalidateQueries({ queryKey: ["party-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["party-payments", id] });
    },
    onError: (err) => setChequeError(axiosErrorMessage(err) ?? "Failed to update cheque"),
  });

  if (partyLoading || !party) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/parties" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to Parties
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{party.name}</h1>
            <p className="text-sm capitalize text-gray-500 dark:text-gray-400">
              {party.type} {party.phone && `· ${party.phone}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(Number(party.cachedBalance))}</p>
            {Number(party.creditLimit) > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">Limit {formatCurrency(Number(party.creditLimit))}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setModal("payment")} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Record Payment
        </button>
        {party.phone && Number(party.cachedBalance) > 0 && (
          <a
            href={buildWhatsAppLink(
              party.phone,
              buildBalanceReminderMessage(party.name, formatCurrency(Number(party.cachedBalance))),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            <MessageCircle size={15} />
            Send Reminder
          </a>
        )}
        {canManageLedger && (
          <>
            <button
              onClick={() => setModal("opening-balance")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Opening Balance
            </button>
            <button
              onClick={() => setModal("adjustment")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Ledger Adjustment
            </button>
          </>
        )}
      </div>

      <BillHistory party={party} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Payments</h2>
        {chequeError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{chequeError}</p>}
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Applied To</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Cheque</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paymentsList?.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {p.invoiceId && p.invoiceNo ? (
                      <Link to={`/invoices/${p.invoiceId}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {p.invoiceNo}
                      </Link>
                    ) : (
                      <span className="italic">On Account</span>
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{p.method.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(p.amount))}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {p.cheque ? `${p.cheque.chequeNo} · ${p.cheque.status}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.cheque?.status === "pending" && canManageCheques && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setChequeError(null);
                            chequeMutation.mutate({ chequeId: p.cheque!.id, status: "cleared" });
                          }}
                          className="text-green-600 hover:underline dark:text-green-400"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => {
                            setChequeError(null);
                            chequeMutation.mutate({ chequeId: p.cheque!.id, status: "bounced" });
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
              {paymentsList?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Ledger History</h2>
        {ledgerLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Direction</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ledger?.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{entry.sourceType.replace("_", " ")}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          entry.direction === "debit"
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }
                      >
                        {entry.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(entry.amount))}</td>
                  </tr>
                ))}
                {ledger?.entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No ledger history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "payment" && (
        <Modal title="Record Payment" onClose={() => setModal(null)}>
          <RecordPaymentForm partyId={id!} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "opening-balance" && (
        <Modal title="Post Opening Balance" onClose={() => setModal(null)}>
          <LedgerEntryForm partyId={id!} kind="opening-balance" onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "adjustment" && (
        <Modal title="Post Ledger Adjustment" onClose={() => setModal(null)}>
          <LedgerEntryForm partyId={id!} kind="adjustment" onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
