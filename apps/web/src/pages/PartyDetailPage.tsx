import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BookText, CreditCard, Download, Link2, Lock, MessageCircle, Receipt, Repeat, ShoppingBag, Trophy, Truck, Wallet } from "lucide-react";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { buildWhatsAppLink } from "../lib/whatsapp";
import { useSendReminder } from "../hooks/useSendReminder";
import { useAuthStore } from "../store/authStore";
import { getParty, getPartyPublicLink, downloadPartyStatement, type Party } from "../lib/api/parties";
import { getPartyLedger, postLedgerAdjustment, postOpeningBalance } from "../lib/api/ledger";
import { createRateLock, listRateLocksForParty, type CreateRateLockInput } from "../lib/api/rateLocks";
import { ProductPicker } from "../components/ProductPicker";
import type { Product } from "../lib/api/products";
import {
  createPayment,
  listPartyBills,
  listPartyPayments,
  updateChequeStatus,
  type CreatePaymentInput,
  type PartyBill,
} from "../lib/api/payments";
import { listInvoices, getInvoice } from "../lib/api/invoices";
import type { RepeatOrderState } from "./SaleInvoicePage";

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

const STAT_ACCENT = {
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", icon: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-green-50 dark:bg-green-500/10", icon: "text-green-600 dark:text-green-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400" },
  red: { bg: "bg-red-50 dark:bg-red-500/10", icon: "text-red-600 dark:text-red-400" },
  gray: { bg: "bg-gray-100 dark:bg-gray-800", icon: "text-gray-500 dark:text-gray-400" },
};

function StatTile({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: typeof Trophy;
  accent: keyof typeof STAT_ACCENT;
  label: string;
  value: string;
}) {
  const colors = STAT_ACCENT[accent];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${colors.bg}`}>
          <Icon size={14} className={colors.icon} />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <Receipt size={16} className="text-gray-400" />
        {party.type === "supplier" ? "Purchase History" : "Sales History"}
      </h2>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile
          icon={party.type === "supplier" ? Truck : ShoppingBag}
          accent="blue"
          label={party.type === "supplier" ? "Purchases" : "Orders"}
          value={String(orderCount)}
        />
        <StatTile icon={Trophy} accent="amber" label="Lifetime Value" value={formatCurrency(lifetimeValue)} />
        <StatTile icon={CreditCard} accent="gray" label="Avg Bill" value={formatCurrency(avgOrder)} />
        <StatTile icon={Receipt} accent="gray" label="Last Bill" value={lastPurchase ? new Date(lastPurchase).toLocaleDateString() : "—"} />
        <StatTile
          icon={Wallet}
          accent={outstandingBills > 0 ? "red" : "green"}
          label="Unsettled Bills"
          value={String(outstandingBills)}
        />
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Paid</th>
                <th className="px-4 py-2.5 font-medium">Balance Due</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv) => {
                const bill = billByInvoiceId.get(inv.id);
                return (
                  <tr key={inv.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{formatCurrency(Number(inv.totalAmount))}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{bill ? formatCurrency(bill.paidTotal) : "—"}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                      {bill ? formatCurrency(Math.max(0, bill.balanceDue)) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
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
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
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

function RateLockForm({ partyId, onDone }: { partyId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [product, setProduct] = useState<Product | null>(null);
  const [lockedPrice, setLockedPrice] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const [validFrom, setValidFrom] = useState(today);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const input: CreateRateLockInput = {
        partyId,
        productId: product!.id,
        lockedPrice,
        validFrom,
        validUntil,
        notes: notes || null,
      };
      return createRateLock(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party-rate-locks", partyId] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to create rate lock"),
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
        <label className={labelClass}>Product</label>
        {product ? (
          <div className="mt-1 flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">
            <span className="text-gray-900 dark:text-gray-100">{product.name}</span>
            <button type="button" onClick={() => setProduct(null)} className="text-xs text-gray-400 hover:text-red-600">
              Change
            </button>
          </div>
        ) : (
          <ProductPicker
            onSelect={(p) => {
              setProduct(p);
              setLockedPrice(Number(p.salePrice));
            }}
          />
        )}
      </div>
      <div>
        <label className={labelClass}>Locked Price (per base unit)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={lockedPrice}
          onChange={(e) => setLockedPrice(Number(e.target.value))}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Valid From</label>
          <input type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Valid Until</label>
          <input type="date" required value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="e.g. Reason for the price protection" />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!product || !validUntil || mutation.isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Lock Rate"}
        </button>
      </div>
    </form>
  );
}

export function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canManageLedger = role === "owner" || role === "manager";
  const canManageCheques = role === "owner" || role === "manager" || role === "accountant";

  const [modal, setModal] = useState<null | "payment" | "opening-balance" | "adjustment" | "rate-lock">(null);
  const [chequeError, setChequeError] = useState<string | null>(null);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);

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

  const { data: rateLocks } = useQuery({
    queryKey: ["party-rate-locks", id],
    queryFn: () => listRateLocksForParty(id!),
    enabled: !!id,
  });

  const { data: paymentsList } = useQuery({
    queryKey: ["party-payments", id],
    queryFn: () => listPartyPayments(id!),
    enabled: !!id,
  });

  const { sendReminder, loadingId: reminderLoadingId } = useSendReminder();
  const [statementError, setStatementError] = useState<string | null>(null);
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [repeatOrderLoading, setRepeatOrderLoading] = useState(false);

  const { data: recentSales } = useQuery({
    queryKey: ["party-invoices", id, "sale", "recent"],
    queryFn: () => listInvoices({ partyId: id!, type: "sale", limit: 5 }),
    enabled: !!id,
  });
  const lastSale = recentSales?.data.find((inv) => inv.status !== "void");

  async function handleRepeatLastOrder() {
    if (!lastSale) return;
    setRepeatOrderLoading(true);
    try {
      const { items } = await getInvoice(lastSale.id);
      const state: RepeatOrderState = {
        repeatOrder: {
          partyId: lastSale.partyId!,
          items: items.map((i) => ({ productId: i.productId, unitId: i.unitId, quantity: Number(i.quantity) })),
        },
      };
      navigate("/sale", { state });
    } finally {
      setRepeatOrderLoading(false);
    }
  }

  async function handleDownloadStatement() {
    if (!id) return;
    setStatementError(null);
    setDownloadingStatement(true);
    try {
      const blob = await downloadPartyStatement(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setStatementError(axiosErrorMessage(err) ?? "Failed to generate statement");
    } finally {
      setDownloadingStatement(false);
    }
  }

  const chequeMutation = useMutation({
    mutationFn: ({ chequeId, status }: { chequeId: string; status: "cleared" | "bounced" }) => updateChequeStatus(chequeId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["party", id] });
      queryClient.invalidateQueries({ queryKey: ["party-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["party-payments", id] });
    },
    onError: (err) => setChequeError(axiosErrorMessage(err) ?? "Failed to update cheque"),
  });

  const shareLinkMutation = useMutation({
    mutationFn: () => getPartyPublicLink(id!),
    onSuccess: ({ token }) => {
      setShareLinkError(null);
      const url = `${window.location.origin}/balance/${token}`;
      const message = `Assalam-o-Alaikum ${party?.name}, aap apna balance yahan khud check kar sakte hain: ${url}`;
      window.open(buildWhatsAppLink(party!.phone!, message), "_blank", "noopener,noreferrer");
    },
    onError: (err) => setShareLinkError(axiosErrorMessage(err) ?? "Failed to create link"),
  });

  if (partyLoading || !party) return <Loader full />;

  const balance = Number(party.cachedBalance);
  const isCustomer = party.type === "customer";
  const balanceLabel = balance <= 0.01 ? "Settled" : isCustomer ? "Owed to you" : "You owe";

  return (
    <div className="space-y-6">
      <Link to="/customers" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Back to Customers
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* sidebar — profile, balance, actions */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${
                  isCustomer
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                    : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                }`}
              >
                {initials(party.name)}
              </div>
              <h1 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{party.name}</h1>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    isCustomer
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                  }`}
                >
                  {party.type}
                </span>
                {party.phone && <span className="text-sm text-gray-500 dark:text-gray-400">{party.phone}</span>}
              </div>
              {party.hasBouncedCheque && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <AlertTriangle size={12} />
                  Has a bounced cheque on record
                </div>
              )}
            </div>

            <div
              className={`rounded-2xl p-5 text-white shadow-sm ${
                balance <= 0.01
                  ? "bg-linear-to-br from-gray-500 to-gray-700"
                  : isCustomer
                    ? "bg-linear-to-br from-blue-600 to-blue-800"
                    : "bg-linear-to-br from-orange-500 to-orange-700"
              }`}
            >
              <p className="text-sm font-medium text-white/80">{balanceLabel}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(balance)}</p>
              {Number(party.creditLimit) > 0 && (
                <p className="mt-2 text-xs text-white/70">Credit limit {formatCurrency(Number(party.creditLimit))}</p>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <button
                onClick={() => setModal("payment")}
                className="w-full rounded-md bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Record Payment
              </button>
              {isCustomer && lastSale && (
                <button
                  onClick={handleRepeatLastOrder}
                  disabled={repeatOrderLoading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Repeat size={15} />
                  {repeatOrderLoading ? "Loading…" : "Repeat Last Order"}
                </button>
              )}
              {party.phone && balance > 0.01 && (
                <button
                  onClick={() => sendReminder({ id: party.id, name: party.name, phone: party.phone! }, balance)}
                  disabled={reminderLoadingId === party.id}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-green-300 px-3 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                >
                  <MessageCircle size={15} />
                  {reminderLoadingId === party.id ? "Preparing…" : "Send Reminder"}
                </button>
              )}
              {isCustomer && party.phone && (
                <button
                  onClick={() => shareLinkMutation.mutate()}
                  disabled={shareLinkMutation.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Link2 size={15} />
                  {shareLinkMutation.isPending ? "Preparing…" : "Share Balance Link"}
                </button>
              )}
              <button
                onClick={handleDownloadStatement}
                disabled={downloadingStatement}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Download size={15} />
                {downloadingStatement ? "Preparing…" : "Download Statement (PDF)"}
              </button>
              {shareLinkError && <p className="text-sm text-red-600 dark:text-red-400">{shareLinkError}</p>}
              {statementError && <p className="text-sm text-red-600 dark:text-red-400">{statementError}</p>}

              {canManageLedger && (
                <div className="flex items-center justify-center gap-3 pt-1 text-xs text-gray-400 dark:text-gray-500">
                  <button onClick={() => setModal("opening-balance")} className="hover:text-gray-600 hover:underline dark:hover:text-gray-300">
                    Opening Balance
                  </button>
                  <span>·</span>
                  <button onClick={() => setModal("adjustment")} className="hover:text-gray-600 hover:underline dark:hover:text-gray-300">
                    Ledger Adjustment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* main — history */}
        <div className="space-y-6 lg:col-span-2">
          <BillHistory party={party} />

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Wallet size={16} className="text-gray-400" />
              Payments
            </h2>
            {chequeError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{chequeError}</p>}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Applied To</th>
                    <th className="px-4 py-2.5 font-medium">Method</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Cheque</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paymentsList?.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {p.invoiceId && p.invoiceNo ? (
                          <Link to={`/invoices/${p.invoiceId}`} className="text-blue-600 hover:underline dark:text-blue-400">
                            {p.invoiceNo}
                          </Link>
                        ) : (
                          <span className="italic">On Account</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-gray-600 dark:text-gray-400">{p.method.replace("_", " ")}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(p.amount))}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {p.cheque ? `${p.cheque.chequeNo} · ${p.cheque.status}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
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
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {isCustomer && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <Lock size={16} className="text-gray-400" />
                  Rate Locks
                </h2>
                {canManageLedger && (
                  <button
                    onClick={() => setModal("rate-lock")}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Lock a Rate
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Product</th>
                      <th className="px-4 py-2.5 text-right font-medium">Locked Price</th>
                      <th className="px-4 py-2.5 font-medium">Valid</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rateLocks?.map((lock) => {
                      const active = new Date(lock.validFrom) <= new Date() && new Date() <= new Date(lock.validUntil);
                      return (
                        <tr key={lock.id}>
                          <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{lock.productName}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(Number(lock.lockedPrice))}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                            {new Date(lock.validFrom).toLocaleDateString()} – {new Date(lock.validUntil).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                active
                                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                            >
                              {active ? "Active" : "Expired"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {rateLocks?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                          No rate locks for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <BookText size={16} className="text-gray-400" />
              Ledger History
            </h2>
            {ledgerLoading ? (
              <Loader />
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Source</th>
                      <th className="px-4 py-2.5 font-medium">Direction</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ledger?.entries.map((entry) => (
                      <tr key={entry.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{new Date(entry.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 capitalize text-gray-600 dark:text-gray-400">{entry.sourceType.replace("_", " ")}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              entry.direction === "debit"
                                ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            }`}
                          >
                            {entry.direction}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(entry.amount))}</td>
                      </tr>
                    ))}
                    {ledger?.entries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                          No ledger history yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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
      {modal === "rate-lock" && (
        <Modal title="Lock a Rate" onClose={() => setModal(null)}>
          <RateLockForm partyId={id!} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
