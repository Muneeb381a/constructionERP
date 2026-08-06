import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { formatCurrency } from "../lib/format";

export type InvoiceCharge = { label: string; amount: number };

const QUICK_PRESETS = ["Loader", "Rolly"];

/** Named add-on charges (loader/rolly labor, freight, etc.) added on top of the item
 * subtotal — used on both the Sale and Purchase invoice screens. Committing a charge
 * (and so getting it into the bill's total) doesn't require finding and clicking the
 * small "+" button: pressing Enter in either field, or simply leaving the amount field
 * once both a label and a valid amount are present, adds it automatically. The "+"
 * button still works too, for anyone who prefers to click it. */
export function ChargesEditor({ charges, onChange }: { charges: InvoiceCharge[]; onChange: (charges: InvoiceCharge[]) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  function add() {
    const finalLabel = label.trim();
    const finalAmount = Number(amount);
    if (!finalLabel || !(finalAmount > 0)) return;
    onChange([...charges, { label: finalLabel, amount: finalAmount }]);
    setLabel("");
    setAmount("");
  }

  function selectPreset(preset: string) {
    setLabel(preset);
    // jump straight to the amount so typing a number is the very next thing they do
    setTimeout(() => amountRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-2">
      {charges.map((c, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{c.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-900 dark:text-gray-100">{formatCurrency(c.amount)}</span>
            <button
              type="button"
              onClick={() => onChange(charges.filter((_, j) => j !== i))}
              aria-label={`Remove ${c.label}`}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}

      <div className="flex gap-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Loader"
          list="charge-label-presets"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <datalist id="charge-label-presets">
          {QUICK_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <input
          ref={amountRef}
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => add()}
          placeholder="Amount"
          className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => add()}
          disabled={!label.trim() || !(Number(amount) > 0)}
          className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Plus size={14} />
        </button>
      </div>

      {charges.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => selectPreset(p)}
              className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-blue-700 dark:hover:text-blue-300"
            >
              + {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
