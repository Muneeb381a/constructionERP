import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { useShopContext } from "../hooks/useShopContext";
import { listUnits } from "../lib/api/units";
import { createQuotation } from "../lib/api/quotations";
import { getProduct } from "../lib/api/products";
import type { Party } from "../lib/api/parties";
import type { EstimateQuotationState } from "./EstimatorPage";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CreateQuotationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === "owner" || user?.role === "manager" || user?.role === "cashier";

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const shop = useShopContext();

  const { cart, addProduct, updateItem, removeItem, subtotal } = useInvoiceCart(units, "salePrice");
  const [party, setParty] = useState<Party | null>(null);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const estimateHandled = useRef(false);

  // Arrives here via router state from the Material Estimator once a shop assistant links
  // calculated quantities to real products.
  useEffect(() => {
    const state = location.state as EstimateQuotationState | null;
    if (!state?.estimate || estimateHandled.current) return;
    estimateHandled.current = true;

    setEstimateLoading(true);
    (async () => {
      for (const item of state.estimate.items) {
        const product = await getProduct(item.productId);
        await addProduct(product, { quantity: item.quantity, unitId: item.unitId });
      }
      setEstimateLoading(false);
      navigate(location.pathname, { replace: true, state: null });
    })();
    // deliberately runs once on mount only, mirroring SaleInvoicePage's repeat-order pre-fill
  }, []);

  const total = round2(subtotal - discount);

  const mutation = useMutation({
    mutationFn: () =>
      createQuotation({
        branchId: shop.branchId,
        partyId: party?.id ?? null,
        discount: discount || undefined,
        validUntil: validUntil || null,
        notes: notes || null,
        items: cart.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          unitPrice: item.unitId === item.baseUnitId ? undefined : item.unitPrice,
        })),
      }),
    onSuccess: (result) => navigate(`/quotations/${result.quotation.id}`),
    onError: (err) => setSubmitError(axiosErrorMessage(err) ?? "Failed to create quotation"),
  });

  if (!canCreate) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Your role isn't permitted to create quotations.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Quotation</h1>

      {estimateLoading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Loading materials from the estimator…
        </div>
      )}

      <div>
        <label className={labelClass}>Valid Until (optional)</label>
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass + " max-w-xs"} />
      </div>

      <div>
        <label className={labelClass}>Customer / Contractor</label>
        <PartyPicker type="customer" placeholder="Search or add a customer…" selected={party} onSelect={setParty} onClear={() => setParty(null)} />
      </div>

      <div>
        <label className={labelClass}>Add Item</label>
        <ProductPicker onSelect={addProduct} />
      </div>

      <CartTable cart={cart} onUpdate={updateItem} onRemove={removeItem} />

      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="e.g. Site address, terms…" />
      </div>

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
              onChange={(e) => setDiscount(Math.min(subtotal, Math.max(0, Number(e.target.value))))}
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
          {submitError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={cart.length === 0 || !shop.branchId || mutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Quotation"}
        </button>
      </div>
    </div>
  );
}
