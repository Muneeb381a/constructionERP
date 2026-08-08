import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, PackagePlus, Receipt, Truck } from "lucide-react";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { ChargesEditor, type InvoiceCharge } from "../components/ChargesEditor";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { useShopContext } from "../hooks/useShopContext";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listUnits } from "../lib/api/units";
import { createPurchaseInvoice, type CreatePurchaseInvoiceInput } from "../lib/api/invoices";
import { getParty, type Party } from "../lib/api/parties";
import { getProduct } from "../lib/api/products";
import { openInvoicePdf } from "../lib/printInvoice";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type ReorderState = {
  reorder: {
    partyId: string | null;
    items: { productId: string; unitId: number; quantity: number }[];
  };
};

export function PurchaseInvoicePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const canPurchase = user?.role === "owner" || user?.role === "manager";

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const shop = useShopContext();

  const { cart, addProduct, updateItem, removeItem, clear, subtotal } = useInvoiceCart(units, "purchasePrice");
  const [party, setParty] = useState<Party | null>(null);
  const [discount, setDiscount] = useState(0);
  const [charges, setCharges] = useState<InvoiceCharge[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successInvoiceNo, setSuccessInvoiceNo] = useState<string | null>(null);
  const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);
  const [printBlocked, setPrintBlocked] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const reorderHandled = useRef(false);

  // arrives via router state from Reports → Reorder Suggestions — resolves each product at
  // today's purchase price rather than whatever it cost last time
  useEffect(() => {
    const state = location.state as ReorderState | null;
    if (!state?.reorder || reorderHandled.current) return;
    reorderHandled.current = true;

    setReorderLoading(true);
    (async () => {
      if (state.reorder.partyId) setParty(await getParty(state.reorder.partyId));
      for (const item of state.reorder.items) {
        const product = await getProduct(item.productId);
        await addProduct(product, { quantity: item.quantity, unitId: item.unitId });
      }
      setReorderLoading(false);
      navigate(location.pathname, { replace: true, state: null });
    })();
  }, []);

  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const total = round2(subtotal - discount + chargesTotal);

  const mutation = useMutation({
    mutationFn: (input: CreatePurchaseInvoiceInput) => createPurchaseInvoice(input),
    onSuccess: async (result) => {
      setSuccessInvoiceNo(result.invoice.invoiceNo);
      setSuccessInvoiceId(result.invoice.id);
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      clear();
      setParty(null);
      setDiscount(0);
      setCharges([]);
      setSubmitError(null);
      setIdempotencyKey(crypto.randomUUID());

      const opened = await openInvoicePdf(result.invoice.id);
      setPrintBlocked(!opened);
    },
    onError: (err) => {
      setSubmitError(axiosErrorMessage(err) ?? "Failed to create purchase");
    },
  });

  function submit() {
    setSubmitError(null);
    mutation.mutate({
      idempotencyKey,
      branchId: shop.branchId,
      warehouseId: shop.warehouseId,
      partyId: party?.id ?? null,
      discount: discount || undefined,
      otherCharges: charges.length ? charges : undefined,
      items: cart.map((item) => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: item.quantity,
        unitPrice: item.unitId === item.baseUnitId ? undefined : item.unitPrice,
      })),
    });
  }

  if (!canPurchase) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Your role isn't permitted to create purchase invoices.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">New Purchase</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Record a supplier bill, then complete it below.</p>
      </div>

      {reorderLoading && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Loading reorder items — prices are refreshed to today's rates…
        </div>
      )}

      {successInvoiceNo && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Purchase invoice {successInvoiceNo} created.
                {printBlocked && " Your browser blocked the automatic print tab — use the button below."}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={async () => {
                  if (successInvoiceId) setPrintBlocked(!(await openInvoicePdf(successInvoiceId)));
                }}
                className="font-medium hover:underline"
              >
                Print Invoice
              </button>
              <button
                onClick={() => {
                  setSuccessInvoiceNo(null);
                  setSuccessInvoiceId(null);
                }}
                className="font-medium hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-orange-500" />
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-500/10">
                <Truck size={14} className="text-orange-600 dark:text-orange-400" />
              </span>
              Supplier
            </h2>
            <PartyPicker
              type="supplier"
              placeholder="Search supplier (optional for a cash purchase)…"
              selected={party}
              onSelect={setParty}
              onClear={() => setParty(null)}
            />
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-500" />
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                <PackagePlus size={14} className="text-amber-600 dark:text-amber-400" />
              </span>
              Items
            </h2>
            <ProductPicker onSelect={addProduct} />
            <div className="mt-3">
              <CartTable cart={cart} onUpdate={updateItem} onRemove={removeItem} />
            </div>
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

            {submitError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                <p>{submitError}</p>
              </div>
            )}

            <button
              onClick={submit}
              disabled={cart.length === 0 || !shop.warehouseId || mutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:opacity-50"
            >
              <Truck size={16} />
              {mutation.isPending ? "Saving…" : `Complete Purchase · ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
