import { useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import { formatCurrency } from "../lib/format";

export type InvoiceCharge = { label: string; amount: number };

const QUICK_PRESETS = ["Loader", "Rolly"];

/** Named add-on charges (loader/rolly labor, freight, or anything else the shop wants to
 * bill at their own discretion) — added on top of the item subtotal, used on both the
 * Sale and Purchase invoice screens. Fully custom: the label is free text, the presets
 * below are just a shortcut for the two most common ones. There's no separate "add"
 * button to find and click — press Enter in either field, or just move on to the next
 * field/click elsewhere once both a label and a valid amount are filled in, and it's
 * added to the bill immediately. */
export function ChargesEditor({ charges, onChange }: { charges: InvoiceCharge[]; onChange: (charges: InvoiceCharge[]) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const labelRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  function add() {
    const finalLabel = label.trim();
    const finalAmount = Number(amount);
    if (!finalLabel || !(finalAmount > 0)) return;
    onChange([...charges, { label: finalLabel, amount: finalAmount }]);
    setLabel("");
    setAmount("");
    labelRef.current?.focus();
  }

  function selectPreset(preset: string) {
    setLabel(preset);
    // jump straight to the amount so typing a number is the very next thing they do
    setTimeout(() => amountRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-2.5">
      {charges.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-800/30">
          {charges.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Tag size={12} className="shrink-0 text-amber-500" />
                <span className="truncate">{c.label}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(c.amount)}</span>
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
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {QUICK_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => selectPreset(p)}
            className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500 hover:border-amber-300 hover:text-amber-700 dark:border-gray-700 dark:text-gray-400 dark:hover:border-amber-700 dark:hover:text-amber-300"
          >
            + {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTimeout(() => labelRef.current?.focus(), 0)}
          className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-500 hover:border-amber-300 hover:text-amber-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-amber-700 dark:hover:text-amber-300"
        >
          + Custom charge
        </button>
      </div>

      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Tag size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={labelRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Charge name"
            className="w-full rounded-md border border-gray-300 py-1.5 pl-7 pr-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
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
          onBlur={add}
          placeholder="Amount"
          className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Type a name and amount, then press Enter — it's added to the bill right away.</p>
    </div>
  );
}
