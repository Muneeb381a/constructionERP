import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { useShopContext } from "../hooks/useShopContext";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listUnits } from "../lib/api/units";
import { createPurchaseInvoice, type CreatePurchaseInvoiceInput } from "../lib/api/invoices";
import { getParty, type Party } from "../lib/api/parties";
import { getProduct } from "../lib/api/products";

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
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successInvoiceNo, setSuccessInvoiceNo] = useState<string | null>(null);
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

  const total = round2(subtotal - discount);

  const mutation = useMutation({
    mutationFn: (input: CreatePurchaseInvoiceInput) => createPurchaseInvoice(input),
    onSuccess: (result) => {
      setSuccessInvoiceNo(result.invoice.invoiceNo);
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      clear();
      setParty(null);
      setDiscount(0);
      setSubmitError(null);
      setIdempotencyKey(crypto.randomUUID());
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
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Purchase</h1>

      {reorderLoading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Loading reorder items — prices are refreshed to today's rates…
        </div>
      )}

      {successInvoiceNo && (
        <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          <span>Purchase invoice {successInvoiceNo} created.</span>
          <button onClick={() => setSuccessInvoiceNo(null)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
        <PartyPicker
          type="supplier"
          placeholder="Search supplier (optional for a cash purchase)…"
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
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={cart.length === 0 || !shop.warehouseId || mutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Complete Purchase"}
        </button>
      </div>
    </div>
  );
}
