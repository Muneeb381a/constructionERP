import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { inputClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { listWarehouses } from "../lib/api/warehouses";
import { listUnits } from "../lib/api/units";
import { getProduct } from "../lib/api/products";
import { getInvoice, createReturnInvoice } from "../lib/api/invoices";

export function ReturnInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
  });

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });

  const items = data?.items ?? [];
  const productIds = useMemo(() => [...new Set(items.map((i) => i.productId))], [items]);
  const productQueries = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: ["product", productId],
      queryFn: () => getProduct(productId),
    })),
  });
  const productNames = useMemo(() => {
    const map = new Map<string, string>();
    productIds.forEach((productId, i) => {
      const name = productQueries[i]?.data?.name;
      if (name) map.set(productId, name);
    });
    return map;
  }, [productIds, productQueries]);

  const [returnQty, setReturnQty] = useState<Record<number, number>>({});
  const [warehouseId, setWarehouseId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [successInvoiceNo, setSuccessInvoiceNo] = useState<string | null>(null);

  const branchWarehouses = useMemo(
    () => (warehouses ?? []).filter((w) => w.branchId === data?.invoice.branchId),
    [warehouses, data],
  );
  const effectiveWarehouseId = warehouseId || branchWarehouses[0]?.id || "";

  const mutation = useMutation({
    mutationFn: () =>
      createReturnInvoice({
        idempotencyKey,
        originalInvoiceId: id!,
        branchId: data!.invoice.branchId,
        warehouseId: effectiveWarehouseId,
        items: items
          .filter((item) => (returnQty[item.id] ?? 0) > 0)
          .map((item) => ({ productId: item.productId, unitId: item.unitId, quantity: returnQty[item.id]! })),
      }),
    onSuccess: (result) => {
      setSuccessInvoiceNo(result.invoice.invoiceNo);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setReturnQty({});
      setIdempotencyKey(crypto.randomUUID());
    },
    onError: (err) => setSubmitError(axiosErrorMessage(err) ?? "Failed to create return"),
  });

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600 dark:text-red-400">Invoice not found.</p>;

  const { invoice } = data;

  if (invoice.type !== "sale" && invoice.type !== "purchase") {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Returns can only be created against a sale or purchase invoice.</p>;
  }
  if (invoice.status === "void") {
    return <p className="text-sm text-red-600 dark:text-red-400">This invoice has been voided and can't be returned against.</p>;
  }

  const returnType = invoice.type === "sale" ? "sale_return" : "purchase_return";
  const roleBlocked = returnType === "purchase_return" && role === "cashier";
  const hasAnyQuantity = items.some((item) => (returnQty[item.id] ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/invoices/${invoice.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to {invoice.invoiceNo}
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Return against {invoice.invoiceNo}
        </h1>
      </div>

      {successInvoiceNo && (
        <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
          <span>Return invoice {successInvoiceNo} created.</span>
          <Link to={`/invoices/${invoice.id}`} className="font-medium hover:underline">
            View original invoice
          </Link>
        </div>
      )}

      {roleBlocked ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Only an owner or manager can process a purchase return.</p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Warehouse</label>
            <select value={effectiveWarehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass + " max-w-xs"}>
              {branchWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Unit</th>
                  <th className="px-4 py-2 font-medium">Original Qty</th>
                  <th className="px-4 py-2 font-medium">Unit Price</th>
                  <th className="px-4 py-2 font-medium">Return Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{productNames.get(item.productId) ?? item.productId}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {units?.find((u) => u.id === item.unitId)?.name ?? item.unitId}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{item.quantity}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max={item.quantity}
                        value={returnQty[item.id] ?? 0}
                        onChange={(e) => setReturnQty((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {submitError && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => {
                setSubmitError(null);
                mutation.mutate();
              }}
              disabled={!hasAnyQuantity || !effectiveWarehouseId || mutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Process Return"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
