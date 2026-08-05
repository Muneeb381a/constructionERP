import { useState } from "react";
import { Modal } from "../../components/Modal";

/** For the highest-blast-radius actions (suspend/close a real client shop) — a plain
 * confirm button is too easy to click without reading. Typing the exact business name
 * forces the operator to actually look at what they're about to affect. */
export function TypeToConfirmDialog({
  title,
  message,
  confirmWord,
  confirmLabel,
  danger = true,
  pending = false,
  error,
  extraField,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmWord: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  extraField?: { label: string; value: string; onChange: (v: string) => void; placeholder?: string };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmWord;

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>

        {extraField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{extraField.label}</label>
            <textarea
              value={extraField.value}
              onChange={(e) => extraField.onChange(e.target.value)}
              placeholder={extraField.placeholder}
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type <span className="font-mono font-semibold">{confirmWord}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || pending}
            className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {pending ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
