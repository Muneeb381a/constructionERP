import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { CloudOff, RefreshCw, User, PackagePlus, Receipt, Banknote } from "lucide-react";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { useOfflineSalesSync } from "../hooks/useOfflineSalesSync";
import { useShopContext } from "../hooks/useShopContext";
import { axiosErrorMessage } from "../lib/errors";
import { inputClass, labelClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listUnits } from "../lib/api/units";
import { createSaleInvoice, type CreateSaleInvoiceInput } from "../lib/api/invoices";
import { getParty, getTopCustomers, type Party } from "../lib/api/parties";
import { getProduct, type Product } from "../lib/api/products";
import { listActiveRateLocksForParty } from "../lib/api/rateLocks";
import { listProjects } from "../lib/api/projects";
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
  const [amountReceived, setAmountReceived] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const offlineSync = useOfflineSalesSync();

  const total = round2(subtotal - discount);
  const balanceAfterPayment = round2(total - amountReceived);

  function resetFormAfterSubmit() {
    clear();
    setParty(null);
    setProjectId("");
    setDiscount(0);
    setAmountReceived(0);
    setPaymentMethod("cash");
    setSubmitError(null);
    setIdempotencyKey(crypto.randomUUID());
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
    onSuccess: (result) => {
      const due = round2(Number(result.invoice.totalAmount) - Number(result.payment?.amount ?? 0));
      const paymentNote = result.payment
        ? due > 0.01
          ? ` — ${formatCurrency(Number(result.payment.amount))} received, ${formatCurrency(due)} still due.`
          : ` — paid in full.`
        : "";
      setSuccessMessage(`Sale invoice ${result.invoice.invoiceNo} created.${paymentNote}`);
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      resetFormAfterSubmit();
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
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Sale</h1>
        {(!offlineSync.isOnline || offlineSync.queued.length > 0) && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <CloudOff size={14} />
            <span>
              {!offlineSync.isOnline ? "Offline" : "Back online"}
              {offlineSync.queued.length > 0 && ` — ${offlineSync.queued.length} sale${offlineSync.queued.length === 1 ? "" : "s"} queued`}
            </span>
            {offlineSync.isOnline && offlineSync.queued.length > 0 && (
              <button
                onClick={() => offlineSync.sync()}
                disabled={offlineSync.syncing}
                className="flex items-center gap-1 rounded border border-amber-400 px-1.5 py-0.5 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:hover:bg-amber-900/50"
              >
                <RefreshCw size={11} className={offlineSync.syncing ? "animate-spin" : ""} />
                {offlineSync.syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
          </div>
        )}
      </div>

      {repeatOrderLoading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Loading their last order — prices are refreshed to today's rates…
        </div>
      )}

      {queuedOffline && (
        <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <span>No connection — sale saved on this device and will sync automatically once you're back online.</span>
          <button onClick={() => setQueuedOffline(false)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <User size={16} className="text-gray-400" />
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

          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <PackagePlus size={16} className="text-gray-400" />
              Items
            </h2>
            {activeRateLocks && activeRateLocks.length > 0 && (
              <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                🔒 {activeRateLocks.length} rate-locked price{activeRateLocks.length === 1 ? "" : "s"} active for this
                customer — applied automatically when added.
              </div>
            )}
            <ProductPicker onSelect={addProductRespectingRateLock} />
            <div className="mt-3">
              <CartTable cart={cart} onUpdate={updateItem} onRemove={removeItem} />
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Receipt size={16} className="text-gray-400" />
              Order Summary
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-gray-600 dark:text-gray-400">Discount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {party && total > 0 && (
              <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
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
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
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
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : `Complete Sale · ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
