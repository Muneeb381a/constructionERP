import { formatCurrency } from "../lib/format";
import type { CartItem } from "../hooks/useInvoiceCart";

export function CartTable({
  cart,
  onUpdate,
  onRemove,
}: {
  cart: CartItem[];
  onUpdate: (key: string, patch: Partial<CartItem>) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <tr>
            <th className="px-4 py-2 font-medium">Product</th>
            <th className="px-4 py-2 font-medium">Unit</th>
            <th className="px-4 py-2 font-medium">Qty</th>
            <th className="px-4 py-2 font-medium">Unit Price</th>
            <th className="px-4 py-2 font-medium">Line Total</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {cart.map((item) => (
            <tr key={item.key}>
              <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{item.productName}</td>
              <td className="px-4 py-2">
                <select
                  value={item.unitId}
                  onChange={(e) => onUpdate(item.key, { unitId: Number(e.target.value) })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {item.unitOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={item.quantity}
                  onChange={(e) => onUpdate(item.key, { quantity: Number(e.target.value) })}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.unitPrice}
                  onChange={(e) => onUpdate(item.key, { unitPrice: Number(e.target.value) })}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </td>
              <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(item.quantity * item.unitPrice)}</td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => onRemove(item.key)} className="text-red-600 hover:underline dark:text-red-400">
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {cart.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                Search a product above to add it.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
