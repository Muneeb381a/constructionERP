import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, CloudOff, FileDown, RefreshCw, ShoppingCart, Truck, User, PackagePlus, Receipt, Banknote } from "lucide-react";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { ChargesEditor, type InvoiceCharge } from "../components/ChargesEditor";
import { ShareInvoiceImageButton } from "../components/ShareInvoiceImageButton";
import type { ReceiptLine } from "../components/ReceiptImage";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { useOfflineSalesSync } from "../hooks/useOfflineSalesSync";
import { useShopContext } from "../hooks/useShopContext";
import { axiosErrorMessage } from "../lib/errors";
import { inputClass, labelClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listUnits } from "../lib/api/units";
import { assignDelivery, createSaleInvoice, fetchDeliveryChallanPdf, type CreateSaleInvoiceInput } from "../lib/api/invoices";
import { getParty, getTopCustomers, type Party } from "../lib/api/parties";
import { getProduct, type Product } from "../lib/api/products";
import { listActiveRateLocksForParty } from "../lib/api/rateLocks";
import { listProjects } from "../lib/api/projects";
import { listEmployees } from "../lib/api/employees";
import { getMyTenant } from "../lib/api/tenants";
import { openInvoicePdf } from "../lib/printInvoice";
import { isNetworkError, queueSale } from "../lib/offlineSalesQueue";

export type RepeatOrderState = {
  repeatOrder: {
    partyId: string;
    items: { productId: string; unitId: number; quantity: number }[];
  };
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function SaleInvoicePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const canSell = user?.role === "owner" || user?.role === "manager" || user?.role === "cashier";
  const canOverrideRole = user?.role === "owner" || user?.role === "manager";

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const { data: topCustomers } = useQuery({ queryKey: ["top-customers-quickpick"], queryFn: () => getTopCustomers(6) });
  const { data: tenant } = useQuery({ queryKey: ["tenant"], queryFn: getMyTenant });
  const shop = useShopContext();

  const { cart, addProduct, updateItem, removeItem, clear, subtotal } = useInvoiceCart(units, "salePrice");
  const [party, setParty] = useState<Party | null>(null);
  const { data: activeRateLocks } = useQuery({
    queryKey: ["active-rate-locks", party?.id],
    queryFn: () => listActiveRateLocksForParty(party!.id),
    enabled: !!party,
  });

  function addProductRespectingRateLock(product: Product) {
    const lock = activeRateLocks?.find((l) => l.productId === product.id);
    addProduct(product, lock ? { unitPrice: Number(lock.lockedPrice) } : undefined);
  }

  const [projectId, setProjectId] = useState("");
  const { data: partyProjects } = useQuery({
    queryKey: ["party-projects", party?.id],
    queryFn: () => listProjects({ partyId: party!.id }),
    enabled: !!party,
  });
  const activeProjects = (partyProjects ?? []).filter((p) => p.status === "active");

  const [deliveryEmployeeId, setDeliveryEmployeeId] = useState("");
  const { data: employees } = useQuery({ queryKey: ["employees", ""], queryFn: () => listEmployees() });
  const [completedInvoice, setCompletedInvoice] = useState<{ id: string; hasDelivery: boolean } | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{
    invoiceNo: string;
    createdAt: string;
    partyName?: string | null;
    partyPhone?: string | null;
    items: ReceiptLine[];
    subtotal: string;
    discount: string;
    otherCharges: InvoiceCharge[] | null;
    totalAmount: string;
  } | null>(null);
  const [downloadingChallan, setDownloadingChallan] = useState(false);
  const [printBlocked, setPrintBlocked] = useState(false);

  const [repeatOrderLoading, setRepeatOrderLoading] = useState(false);
  const repeatOrderHandled = useRef(false);

  // "Repeat Last Order" arrives here via router state from the Customer Detail page —
  // re-resolve each product to today's price rather than trusting the old invoice's price
  useEffect(() => {
    const state = location.state as RepeatOrderState | null;
    if (!state?.repeatOrder || repeatOrderHandled.current) return;
    repeatOrderHandled.current = true;

    setRepeatOrderLoading(true);
    (async () => {
      const fullParty = await getParty(state.repeatOrder.partyId);
      setParty(fullParty);
      for (const item of state.repeatOrder.items) {
        const product = await getProduct(item.productId);
        await addProduct(product, { quantity: item.quantity, unitId: item.unitId });
      }
      setRepeatOrderLoading(false);
      navigate(location.pathname, { replace: true, state: null });
    })();
    // deliberately runs once on mount only — re-running on every location/navigate identity
    // change would re-trigger the repeat-order fill after we've already cleared the state
  }, []);
  const [discount, setDiscount] = useState(0);
  const [charges, setCharges] = useState<InvoiceCharge[]>([]);
  const [amountReceived, setAmountReceived] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const offlineSync = useOfflineSalesSync();

  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const total = round2(subtotal - discount + chargesTotal);
  const balanceAfterPayment = round2(total - amountReceived);

  function resetFormAfterSubmit() {
    clear();
    setParty(null);
    setProjectId("");
    setDeliveryEmployeeId("");
    setDiscount(0);
    setCharges([]);
    setAmountReceived(0);
    setPaymentMethod("cash");
    setSubmitError(null);
    setIdempotencyKey(crypto.randomUUID());
  }

  async function handleDownloadChallan() {
    if (!completedInvoice) return;
    setDownloadingChallan(true);
    try {
      const blob = await fetchDeliveryChallanPdf(completedInvoice.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // best-effort — the invoice's own detail page always has this as a fallback
    } finally {
      setDownloadingChallan(false);
    }
  }

  async function queueOffline(input: CreateSaleInvoiceInput) {
    await queueSale({
      idempotencyKey: input.idempotencyKey,
      input,
      queuedAt: new Date().toISOString(),
      partyName: party?.name ?? null,
      total,
    });
    await offlineSync.refresh();
    setQueuedOffline(true);
    resetFormAfterSubmit();
  }

  const mutation = useMutation({
    mutationFn: (input: CreateSaleInvoiceInput) => createSaleInvoice(input),
    onSuccess: async (result) => {
      const due = round2(Number(result.invoice.totalAmount) - Number(result.payment?.amount ?? 0));
      const paymentNote = result.payment
        ? due > 0.01
          ? ` — ${formatCurrency(Number(result.payment.amount))} received, ${formatCurrency(due)} still due.`
          : ` — paid in full.`
        : "";

      let hasDelivery = false;
      if (deliveryEmployeeId) {
        try {
          await assignDelivery(result.invoice.id, deliveryEmployeeId);
          hasDelivery = true;
        } catch {
          // the sale itself already succeeded — don't lose that over a delivery-assign hiccup,
          // the invoice's own detail page can still assign it afterward
        }
      }

      setCompletedInvoice({ id: result.invoice.id, hasDelivery });
      setCompletedReceipt({
        invoiceNo: result.invoice.invoiceNo,
        createdAt: result.invoice.createdAt,
        partyName: party?.name,
        partyPhone: party?.phone,
        items: cart.map((item) => ({
          productName: item.productName,
          unitName: units?.find((u) => u.id === item.unitId)?.name ?? "",
          quantity: String(item.quantity),
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: (item.quantity * item.unitPrice).toFixed(2),
        })),
        subtotal: result.invoice.subtotal,
        discount: result.invoice.discount,
        otherCharges: result.invoice.otherCharges,
        totalAmount: result.invoice.totalAmount,
      });
      setSuccessMessage(
        `Sale invoice ${result.invoice.invoiceNo} created.${paymentNote}${deliveryEmployeeId && !hasDelivery ? " (delivery assignment failed — assign it from the invoice page)" : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      resetFormAfterSubmit();

      const opened = await openInvoicePdf(result.invoice.id);
      setPrintBlocked(!opened);
    },
    onError: (err, input) => {
      // no server response at all — genuinely offline (or the connection dropped mid-request)
      if (isNetworkError(err)) {
        queueOffline(input);
        return;
      }
      setSubmitError(axiosErrorMessage(err) ?? "Failed to create sale");
    },
  });

  async function selectTopCustomer(id: string) {
    const full = await getParty(id);
    setParty(full);
  }

  function submit(overrideCreditLimit: boolean) {
    setSubmitError(null);
    setQueuedOffline(false);
    const input: CreateSaleInvoiceInput = {
      idempotencyKey,
      branchId: shop.branchId,
      warehouseId: shop.warehouseId,
      partyId: party?.id ?? null,
      projectId: projectId || null,
      discount: discount || undefined,
      otherCharges: charges.length ? charges : undefined,
      overrideCreditLimit: overrideCreditLimit || undefined,
      payment: party && amountReceived > 0 ? { method: paymentMethod, amount: amountReceived } : undefined,
      items: cart.map((item) => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: item.quantity,
        unitPrice: item.unitId === item.baseUnitId ? undefined : item.unitPrice,
      })),
    };

    if (!navigator.onLine) {
      queueOffline(input);
      return;
    }
    mutation.mutate(input);
  }

  if (!canSell) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Your role isn't permitted to create sale invoices.</p>;
  }

  const canOverride = canOverrideRole && submitError?.includes("pass overrideCreditLimit");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">New Sale</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Build the bill, then complete it below.</p>
        </div>
        {(!offlineSync.isOnline || offlineSync.queued.length > 0) && (
          <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <CloudOff size={14} />
            <span>
              {!offlineSync.isOnline ? "Offline" : "Back online"}
              {offlineSync.queued.length > 0 && ` — ${offlineSync.queued.length} sale${offlineSync.queued.length === 1 ? "" : "s"} queued`}
            </span>
            {offlineSync.isOnline && offlineSync.queued.length > 0 && (
              <button
                onClick={() => offlineSync.sync()}
                disabled={offlineSync.syncing}
                className="flex items-center gap-1 rounded-full border border-amber-400 px-2 py-0.5 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:hover:bg-amber-900/50"
              >
                <RefreshCw size={11} className={offlineSync.syncing ? "animate-spin" : ""} />
                {offlineSync.syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
          </div>
        )}
      </div>

      {repeatOrderLoading && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Loading their last order — prices are refreshed to today's rates…
        </div>
      )}

      {queuedOffline && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <span>No connection — sale saved on this device and will sync automatically once you're back online.</span>
          <button onClick={() => setQueuedOffline(false)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {successMessage}
              {printBlocked && " Your browser blocked the automatic print tab — use the button below."}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={async () => {
                if (completedInvoice) setPrintBlocked(!(await openInvoicePdf(completedInvoice.id)));
              }}
              className="flex items-center gap-1 font-medium hover:underline"
            >
              <FileDown size={14} />
              Print Invoice
            </button>
            {completedInvoice?.hasDelivery && (
              <button
                onClick={handleDownloadChallan}
                disabled={downloadingChallan}
                className="flex items-center gap-1 font-medium hover:underline disabled:opacity-50"
              >
                <FileDown size={14} />
                {downloadingChallan ? "Preparing…" : "Print Delivery Challan"}
              </button>
            )}
            {completedReceipt && (
              <ShareInvoiceImageButton
                invoiceNo={completedReceipt.invoiceNo}
                type="sale"
                createdAt={completedReceipt.createdAt}
                partyName={completedReceipt.partyName}
                partyPhone={completedReceipt.partyPhone}
                businessName={tenant?.businessName ?? "…"}
                logoUrl={tenant?.logoUrl}
                businessPhone={tenant?.phone}
                items={completedReceipt.items}
                subtotal={completedReceipt.subtotal}
                discount={completedReceipt.discount}
                otherCharges={completedReceipt.otherCharges}
                totalAmount={completedReceipt.totalAmount}
              />
            )}
            <button
              onClick={() => {
                setSuccessMessage(null);
                setCompletedInvoice(null);
                setCompletedReceipt(null);
              }}
              className="font-medium hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-blue-500" />
            <h2 className="mb-3 flex items-center gap-2 pl-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <User size={14} className="text-blue-600 dark:text-blue-400" />
              </span>
              Customer
            </h2>
            {!party && topCustomers && topCustomers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {topCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectTopCustomer(c.id)}
                    className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  >
                    {c.name}
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {c.orderCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <PartyPicker
              type="customer"
              placeholder="Walk-in customer (search to bill on account)…"
              selected={party}
              onSelect={(p) => {
                setParty(p);
                setProjectId("");
              }}
              onClear={() => {
                setParty(null);
                setProjectId("");
                setAmountReceived(0);
              }}
            />
            {party && activeProjects.length > 0 && (
              <div className="mt-3">
                <label className={labelClass}>Link to Project (optional)</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
                  <option value="">— None —</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          <section className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-amber-500" />
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                <PackagePlus size={14} className="text-amber-600 dark:text-amber-400" />
              </span>
              Items
            </h2>
            {activeRateLocks && activeRateLocks.length > 0 && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                🔒 {activeRateLocks.length} rate-locked price{activeRateLocks.length === 1 ? "" : "s"} active for this
                customer — applied automatically when added.
              </div>
            )}
            <ProductPicker onSelect={addProductRespectingRateLock} />
            <div className="mt-3">
              <CartTable cart={cart} onUpdate={updateItem} onRemove={removeItem} />
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-orange-500" />
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-500/10">
                <Truck size={14} className="text-orange-600 dark:text-orange-400" />
              </span>
              Delivery <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
            </h2>
            <select value={deliveryEmployeeId} onChange={(e) => setDeliveryEmployeeId(e.target.value)} className={inputClass}>
              <option value="">Customer picking up — no delivery</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.designation ? ` — ${emp.designation}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Pick who's taking this material out — you'll get a "Print Delivery Challan" button right after saving.
            </p>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <Receipt size={14} className="text-gray-500 dark:text-gray-400" />
              </span>
              Order Summary
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-gray-600 dark:text-gray-400">Discount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Math.min(subtotal, Math.max(0, Number(e.target.value))))}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 dark:border-gray-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Custom Charges <span className="normal-case text-gray-400">(Loader, Rolly, ya kuch bhi)</span>
              </p>
              <ChargesEditor charges={charges} onChange={setCharges} />
            </div>

            <div className="flex items-baseline justify-between rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">Total</span>
              <span className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>
            </div>

            {party && total > 0 && (
              <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    <Banknote size={13} />
                    Received Now
                  </h3>
                  {amountReceived < total && (
                    <button
                      type="button"
                      onClick={() => setAmountReceived(total)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Full amount
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={total}
                    value={amountReceived || ""}
                    onChange={(e) => setAmountReceived(Math.min(total, Math.max(0, Number(e.target.value))))}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                {amountReceived > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {balanceAfterPayment > 0.01
                      ? `Balance due after this sale: ${formatCurrency(balanceAfterPayment)}`
                      : "Fully paid — nothing left on account."}
                  </p>
                )}
              </div>
            )}

            {submitError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                <p>{submitError}</p>
                {canOverride && (
                  <button
                    onClick={() => submit(true)}
                    className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Proceed anyway (will be audit-logged)
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => submit(false)}
              disabled={cart.length === 0 || !shop.warehouseId || mutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:opacity-50"
            >
              <ShoppingCart size={16} />
              {mutation.isPending ? "Saving…" : `Complete Sale · ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
