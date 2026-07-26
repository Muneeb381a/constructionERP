import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { CartTable } from "../components/CartTable";
import { useInvoiceCart } from "../hooks/useInvoiceCart";
import { inputClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listBranches } from "../lib/api/branches";
import { listWarehouses } from "../lib/api/warehouses";
import { listUnits } from "../lib/api/units";
import { createPurchaseInvoice, type CreatePurchaseInvoiceInput } from "../lib/api/invoices";
import type { Party } from "../lib/api/parties";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function PurchaseInvoicePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canPurchase = user?.role === "owner" || user?.role === "manager";

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });

  const [branchId, setBranchId] = useState<string>(user?.branchId ?? "");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const { cart, addProduct, updateItem, removeItem, clear, subtotal } = useInvoiceCart(units, "purchasePrice");
  const [party, setParty] = useState<Party | null>(null);
  const [discount, setDiscount] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successInvoiceNo, setSuccessInvoiceNo] = useState<string | null>(null);

  const effectiveBranchId = branchId || branches?.[0]?.id || "";
  const branchWarehouses = useMemo(
    () => (warehouses ?? []).filter((w) => w.branchId === effectiveBranchId),
    [warehouses, effectiveBranchId],
  );
  const effectiveWarehouseId = warehouseId || branchWarehouses[0]?.id || "";

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
      branchId: effectiveBranchId,
      warehouseId: effectiveWarehouseId,
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

      {successInvoiceNo && (
        <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          <span>Purchase invoice {successInvoiceNo} created.</span>
          <button onClick={() => setSuccessInvoiceNo(null)} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Branch</label>
          <select
            value={effectiveBranchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setWarehouseId("");
            }}
            className={inputClass}
          >
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Warehouse</label>
          <select value={effectiveWarehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
            {branchWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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
          disabled={cart.length === 0 || !effectiveWarehouseId || mutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Complete Purchase"}
        </button>
      </div>
    </div>
  );
}
