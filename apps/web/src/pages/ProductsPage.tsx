import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { RateHistoryChart } from "../components/RateHistoryChart";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { listCategories } from "../lib/api/categories";
import { listUnits } from "../lib/api/units";
import {
  bulkUpdatePrices,
  createProduct,
  getRateHistory,
  listProducts,
  updateProduct,
  type BulkPriceUpdateInput,
  type BulkPriceUpdateResult,
  type Product,
  type ProductInput,
} from "../lib/api/products";

const emptyForm: ProductInput = {
  name: "",
  nameUrdu: "",
  categoryId: null,
  baseUnitId: 0,
  barcode: "",
  purchasePrice: 0,
  salePrice: 0,
  minStock: 0,
  maxStock: null,
};

function ProductForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial: ProductInput;
  onSubmit: (input: ProductInput) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Name</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Name (Urdu)</label>
        <input
          value={form.nameUrdu ?? ""}
          onChange={(e) => setForm({ ...form, nameUrdu: e.target.value })}
          dir="rtl"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Category</label>
          <select
            value={form.categoryId ?? ""}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          >
            <option value="">—</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Base Unit</label>
          <select
            required
            value={form.baseUnitId || ""}
            onChange={(e) => setForm({ ...form, baseUnitId: Number(e.target.value) })}
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {units?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Barcode</label>
        <input value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Purchase Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Sale Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.salePrice}
            onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Min Stock (reorder point)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Max Stock (full capacity)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder="Auto"
            value={form.maxStock ?? ""}
            onChange={(e) => setForm({ ...form, maxStock: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">
        Max Stock sets the "full" level for the stock visuals on the Stock page. Leave blank to auto-estimate from Min Stock.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !form.baseUnitId}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function BulkPriceUpdateForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [priceField, setPriceField] = useState<BulkPriceUpdateInput["priceField"]>("salePrice");
  const [adjustmentType, setAdjustmentType] = useState<BulkPriceUpdateInput["adjustmentType"]>("percentage");
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkPriceUpdateResult | null>(null);

  const { data: preview } = useQuery({
    queryKey: ["products", "bulk-preview", categoryId],
    queryFn: () => listProducts({ categoryId: categoryId === "" ? undefined : categoryId }),
    enabled: categoryId !== "",
  });

  function applyPreview(current: number) {
    const next = adjustmentType === "percentage" ? current * (1 + adjustmentValue / 100) : current + adjustmentValue;
    return Math.max(0, Math.round(next * 100) / 100);
  }

  const mutation = useMutation({
    mutationFn: () =>
      bulkUpdatePrices({
        categoryId: categoryId === "" ? undefined : categoryId,
        priceField,
        adjustmentType,
        adjustmentValue,
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to update prices"),
  });

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Updated {result.updated.length} product{result.updated.length === 1 ? "" : "s"}.
        </p>
        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-3 py-1.5 font-medium">Product</th>
                <th className="px-3 py-1.5 text-right font-medium">Old Sale</th>
                <th className="px-3 py-1.5 text-right font-medium">New Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {result.updated.map((u) => (
                <tr key={u.productId}>
                  <td className="px-3 py-1.5">{u.name}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{formatCurrency(Number(u.oldSalePrice))}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(Number(u.newSalePrice))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <button onClick={onDone} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Category</label>
        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          className={inputClass}
        >
          <option value="">Select category…</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Apply To</label>
        <select value={priceField} onChange={(e) => setPriceField(e.target.value as typeof priceField)} className={inputClass}>
          <option value="salePrice">Sale Price</option>
          <option value="purchasePrice">Purchase Price</option>
          <option value="both">Both</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Adjustment</label>
          <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value as typeof adjustmentType)} className={inputClass}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (Rs)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Value {adjustmentType === "percentage" ? "(+/- %)" : "(+/- Rs)"}</label>
          <input
            type="number"
            step="0.01"
            required
            value={adjustmentValue}
            onChange={(e) => setAdjustmentValue(Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      {categoryId !== "" && preview && preview.data.length > 0 && (
        <div>
          <p className={labelClass}>Preview ({preview.data.length} products)</p>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Product</th>
                  <th className="px-3 py-1.5 text-right font-medium">Current</th>
                  <th className="px-3 py-1.5 text-right font-medium">New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {preview.data.map((p) => {
                  const current = Number(priceField === "purchasePrice" ? p.purchasePrice : p.salePrice);
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5">{p.name}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{formatCurrency(current)}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(applyPreview(current))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {categoryId !== "" && preview && preview.data.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No active products in this category.</p>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={categoryId === "" || mutation.isPending || !preview?.data.length}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Updating…" : "Apply Update"}
        </button>
      </div>
    </form>
  );
}

function RateHistoryModalContent({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["rate-history", productId], queryFn: () => getRateHistory(productId) });
  if (isLoading) return <Loader />;
  return <RateHistoryChart data={data ?? []} />;
}

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | null
    | { mode: "create" }
    | { mode: "edit"; product: Product }
    | { mode: "rate-history"; product: Product }
    | { mode: "bulk-price" }
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["products", search],
    queryFn: () => listProducts({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setModal(null);
    },
    onError: (err) => setFormError(axiosErrorMessage(err) ?? "Failed to save product"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductInput> }) => updateProduct(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setModal(null);
    },
    onError: (err) => setFormError(axiosErrorMessage(err) ?? "Failed to save product"),
  });

  function openCreate() {
    setFormError(null);
    setModal({ mode: "create" });
  }

  function openEdit(product: Product) {
    setFormError(null);
    setModal({ mode: "edit", product });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Products</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ mode: "bulk-price" })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Bulk Price Update
          </button>
          <button
            onClick={openCreate}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Product
          </button>
        </div>
      </div>

      <input
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputClass + " max-w-sm"}
      />

      {isLoading ? (
        <Loader />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Purchase Price</th>
                <th className="px-4 py-2 font-medium">Sale Price</th>
                <th className="px-4 py-2 font-medium">Min Stock</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.data.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{product.name}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(product.purchasePrice))}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(product.salePrice))}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{product.minStock}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setModal({ mode: "rate-history", product })}
                        className="text-gray-500 hover:underline dark:text-gray-400"
                      >
                        Rate Trend
                      </button>
                      <button
                        onClick={() => openEdit(product)}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === "create" && (
        <Modal title="Add Product" onClose={() => setModal(null)}>
          <ProductForm
            initial={emptyForm}
            submitting={createMutation.isPending}
            error={formError}
            onCancel={() => setModal(null)}
            onSubmit={(input) => createMutation.mutate(input)}
          />
        </Modal>
      )}

      {modal?.mode === "edit" && (
        <Modal title="Edit Product" onClose={() => setModal(null)}>
          <ProductForm
            initial={{
              name: modal.product.name,
              nameUrdu: modal.product.nameUrdu,
              categoryId: modal.product.categoryId,
              baseUnitId: modal.product.baseUnitId,
              barcode: modal.product.barcode,
              purchasePrice: Number(modal.product.purchasePrice),
              salePrice: Number(modal.product.salePrice),
              minStock: Number(modal.product.minStock),
              maxStock: modal.product.maxStock != null ? Number(modal.product.maxStock) : null,
            }}
            submitting={updateMutation.isPending}
            error={formError}
            onCancel={() => setModal(null)}
            onSubmit={(input) => updateMutation.mutate({ id: modal.product.id, input })}
          />
        </Modal>
      )}
      {modal?.mode === "rate-history" && (
        <Modal title={`Rate Trend — ${modal.product.name}`} onClose={() => setModal(null)}>
          <RateHistoryModalContent productId={modal.product.id} />
        </Modal>
      )}
      {modal?.mode === "bulk-price" && (
        <Modal title="Bulk Price Update" onClose={() => setModal(null)}>
          <BulkPriceUpdateForm onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
