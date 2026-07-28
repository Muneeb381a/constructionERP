import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { useOfflineSalesSync } from "../hooks/useOfflineSalesSync";
import { useShopContext } from "../hooks/useShopContext";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listUnits } from "../lib/api/units";
import { createSaleInvoice, type CreateSaleInvoiceInput } from "../lib/api/invoices";
import { getParty, getTopCustomers, type Party } from "../lib/api/parties";
import { isNetworkError, queueSale } from "../lib/offlineSalesQueue";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function SaleInvoicePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canSell = user?.role === "owner" || user?.role === "manager" || user?.role === "cashier";
  const canOverrideRole = user?.role === "owner" || user?.role === "manager";

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const { data: topCustomers } = useQuery({ queryKey: ["top-customers-quickpick"], queryFn: () => getTopCustomers(6) });
  const shop = useShopContext();

  const { cart, addProduct, updateItem, removeItem, clear, subtotal } = useInvoiceCart(units, "salePrice");
  const [party, setParty] = useState<Party | null>(null);
  const [discount, setDiscount] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successInvoiceNo, setSuccessInvoiceNo] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const offlineSync = useOfflineSalesSync();

  const total = round2(subtotal - discount);

  function resetFormAfterSubmit() {
    clear();
    setParty(null);
    setDiscount(0);
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
      setSuccessInvoiceNo(result.invoice.invoiceNo);
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
      discount: discount || undefined,
      overrideCreditLimit: overrideCreditLimit || undefined,
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

      {queuedOffline && (
        <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <span>No connection — sale saved on this device and will sync automatically once you're back online.</span>
          <button onClick={() => setQueuedOffline(false)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {successInvoiceNo && (
        <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          <span>Sale invoice {successInvoiceNo} created.</span>
          <button onClick={() => setSuccessInvoiceNo(null)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
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
          onSelect={setParty}
          onClear={() => setParty(null)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Add Item</label>
        <ProductPicker onSelect={addProduct} />
      </div>

      <CartTable cart={cart} onUpdate={updateItem} onRemove={removeItem} />

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">
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
      </div>

      {submitError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
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

      <div className="flex justify-end">
        <button
          onClick={() => submit(false)}
          disabled={cart.length === 0 || !shop.warehouseId || mutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Complete Sale"}
        </button>
      </div>
    </div>
  );
}
