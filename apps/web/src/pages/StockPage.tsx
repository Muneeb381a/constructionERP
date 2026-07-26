import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Search } from "lucide-react";
import { Modal } from "../components/Modal";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/authStore";
import { listBranches } from "../lib/api/branches";
import { createWarehouse, listWarehouses } from "../lib/api/warehouses";
import { adjustStock, createTransfer, listStockByWarehouse, listStockMovements, type StockByWarehouseRow } from "../lib/api/stock";
import { computeStockLevel, MaterialStockVisual, StatusBadge } from "../components/inventory/MaterialStockVisual";

function AdjustStockForm({ row, onDone }: { row: StockByWarehouseRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [quantityChange, setQuantityChange] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => adjustStock({ productId: row.productId, warehouseId: row.warehouseId, quantityChange }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-by-warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to adjust stock"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {row.productName} — current: {row.quantity}
      </p>
      <div>
        <label className={labelClass}>Quantity Change (positive to add, negative to deduct)</label>
        <input
          type="number"
          step="0.001"
          required
          value={quantityChange}
          onChange={(e) => setQuantityChange(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={quantityChange === 0 || mutation.isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Adjust"}
        </button>
      </div>
    </form>
  );
}

function TransferStockForm({
  row,
  warehouses,
  onDone,
}: {
  row: StockByWarehouseRow;
  warehouses: { id: string; name: string }[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const destinations = warehouses.filter((w) => w.id !== row.warehouseId);
  const [toWarehouseId, setToWarehouseId] = useState(destinations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createTransfer({
        idempotencyKey: crypto.randomUUID(),
        productId: row.productId,
        fromWarehouseId: row.warehouseId,
        toWarehouseId,
        quantity,
        note: note || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-by-warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to transfer stock"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {row.productName} — available in this warehouse: {row.quantity} {row.unitName}
      </p>
      <div>
        <label className={labelClass}>Transfer To</label>
        <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} className={inputClass}>
          {destinations.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Quantity</label>
        <input
          type="number"
          step="0.001"
          min="0.001"
          max={Number(row.quantity)}
          required
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={quantity <= 0 || !toWarehouseId || mutation.isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Transferring…" : "Transfer"}
        </button>
      </div>
    </form>
  );
}

function MovementsList({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["stock-movements", productId], queryFn: () => listStockMovements(productId) });

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;

  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Reason</th>
            <th className="px-3 py-2 font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data?.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{new Date(m.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-400">{m.reason.replace("_", " ")}</td>
              <td className={`px-3 py-2 ${Number(m.quantityChange) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {Number(m.quantityChange) >= 0 ? "+" : ""}
                {m.quantityChange}
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                No movements yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddWarehouseForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createWarehouse({ branchId: branchId || branches![0].id, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to create warehouse"),
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
        <label className={labelClass}>Branch</label>
        <select value={branchId || branches?.[0]?.id || ""} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Add Warehouse"}
        </button>
      </div>
    </form>
  );
}

function StockCard({
  row,
  canAdjust,
  onAdjust,
  onHistory,
  onTransfer,
}: {
  row: StockByWarehouseRow;
  canAdjust: boolean;
  onAdjust: () => void;
  onHistory: () => void;
  onTransfer: () => void;
}) {
  const quantity = Number(row.quantity);
  const minStock = Number(row.minStock ?? 0);
  const maxStock = row.maxStock != null ? Number(row.maxStock) : null;
  const { pct, status } = computeStockLevel(quantity, minStock, maxStock);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto w-24">
        <MaterialStockVisual
          quantity={quantity}
          unitName={row.unitName}
          minStock={minStock}
          maxStock={maxStock}
          categoryName={row.categoryName}
        />
      </div>

      <div className="mt-2 text-center">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={row.productName}>
          {row.productName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{row.categoryName ?? "Uncategorized"}</p>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        <span className="font-mono text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {quantity.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{row.unitName}</span>
      </div>

      <div className="mt-1.5 flex justify-center">
        <StatusBadge status={status} />
      </div>

      <p className="mt-1 text-center text-[11px] text-gray-400 dark:text-gray-500">{Math.round(pct)}% of capacity</p>

      <div className="mt-3 flex justify-center gap-3 border-t border-gray-100 pt-2 text-xs dark:border-gray-800">
        <button onClick={onHistory} className="text-blue-600 hover:underline dark:text-blue-400">
          History
        </button>
        {canAdjust && (
          <button onClick={onAdjust} className="text-blue-600 hover:underline dark:text-blue-400">
            Adjust
          </button>
        )}
        {canAdjust && (
          <button onClick={onTransfer} className="text-blue-600 hover:underline dark:text-blue-400">
            Transfer
          </button>
        )}
      </div>
    </div>
  );
}

export function StockPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canAdjust = role === "owner" || role === "manager";

  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });
  const [warehouseId, setWarehouseId] = useState("");
  const effectiveWarehouseId = warehouseId || warehouses?.[0]?.id || "";

  const { data: stock, isLoading } = useQuery({
    queryKey: ["stock-by-warehouse", effectiveWarehouseId],
    queryFn: () => listStockByWarehouse(effectiveWarehouseId),
    enabled: !!effectiveWarehouseId,
  });

  const [adjustRow, setAdjustRow] = useState<StockByWarehouseRow | null>(null);
  const [transferRow, setTransferRow] = useState<StockByWarehouseRow | null>(null);
  const [movementsProductId, setMovementsProductId] = useState<string | null>(null);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");

  const filteredStock = useMemo(() => {
    if (!stock) return stock;
    const q = search.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter((row) => row.productName.toLowerCase().includes(q) || (row.categoryName ?? "").toLowerCase().includes(q));
  }, [stock, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Stock</h1>
        {canAdjust && (
          <button
            onClick={() => setShowAddWarehouse(true)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Add Warehouse
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={effectiveWarehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass + " max-w-xs"}>
          {warehouses?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <div className="relative max-w-xs flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className={inputClass + " pl-8"}
          />
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-gray-300 p-0.5 dark:border-gray-700">
          <button
            onClick={() => setView("cards")}
            aria-label="Card view"
            className={`rounded p-1.5 ${view === "cards" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setView("table")}
            aria-label="Table view"
            className={`rounded p-1.5 ${view === "table" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : view === "cards" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredStock?.map((row) => (
            <StockCard
              key={row.id}
              row={row}
              canAdjust={canAdjust}
              onAdjust={() => setAdjustRow(row)}
              onHistory={() => setMovementsProductId(row.productId)}
              onTransfer={() => setTransferRow(row)}
            />
          ))}
          {filteredStock?.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {search ? "No products match your search." : "No stock recorded for this warehouse yet."}
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Quantity</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStock?.map((row) => {
                const { status } = computeStockLevel(Number(row.quantity), Number(row.minStock ?? 0), row.maxStock != null ? Number(row.maxStock) : null);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.productName}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.categoryName ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {row.quantity} {row.unitName}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setMovementsProductId(row.productId)} className="text-blue-600 hover:underline dark:text-blue-400">
                          History
                        </button>
                        {canAdjust && (
                          <button onClick={() => setAdjustRow(row)} className="text-blue-600 hover:underline dark:text-blue-400">
                            Adjust
                          </button>
                        )}
                        {canAdjust && (
                          <button onClick={() => setTransferRow(row)} className="text-blue-600 hover:underline dark:text-blue-400">
                            Transfer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStock?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    {search ? "No products match your search." : "No stock recorded for this warehouse yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {adjustRow && (
        <Modal title="Adjust Stock" onClose={() => setAdjustRow(null)}>
          <AdjustStockForm row={adjustRow} onDone={() => setAdjustRow(null)} />
        </Modal>
      )}
      {transferRow && (
        <Modal title="Transfer Stock" onClose={() => setTransferRow(null)}>
          <TransferStockForm row={transferRow} warehouses={warehouses ?? []} onDone={() => setTransferRow(null)} />
        </Modal>
      )}
      {movementsProductId && (
        <Modal title="Stock Movements" onClose={() => setMovementsProductId(null)}>
          <MovementsList productId={movementsProductId} />
        </Modal>
      )}
      {showAddWarehouse && (
        <Modal title="Add Warehouse" onClose={() => setShowAddWarehouse(false)}>
          <AddWarehouseForm onDone={() => setShowAddWarehouse(false)} />
        </Modal>
      )}
    </div>
  );
}
