import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { createParty, listParties, type Party } from "../lib/api/parties";
import { axiosErrorMessage } from "../lib/errors";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";

function QuickAddForm({
  type,
  initialName,
  onCreated,
  onCancel,
}: {
  type: "customer" | "supplier";
  initialName: string;
  onCreated: (party: Party) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createParty({ type, name, phone: phone || null }),
    onSuccess: (party) => {
      queryClient.invalidateQueries({ queryKey: ["party-search"] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      onCreated(party);
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to save"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-2 p-3"
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        New {type} — saved once, ready to pick next time
      </p>
      <input
        autoFocus
        required
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <input
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className={inputClass}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || mutation.isPending}
          className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save & Select"}
        </button>
      </div>
    </form>
  );
}

export function PartyPicker({
  type,
  placeholder,
  selected,
  onSelect,
  onClear,
}: {
  type: "customer" | "supplier";
  placeholder?: string;
  selected: Party | null;
  onSelect: (party: Party) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Fetches as soon as the field is focused, not only once the user starts typing —
  // clicking in should immediately show a pickable dropdown (recent parties by default,
  // narrowed by typing), not an empty box until you type the first character.
  const { data } = useQuery({
    queryKey: ["party-search", type, search],
    queryFn: () => listParties({ search: search || undefined, type }),
    enabled: open,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{selected.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Balance {formatCurrency(Number(selected.cachedBalance))}
            {Number(selected.creditLimit) > 0 && ` · Limit ${formatCurrency(Number(selected.creditLimit))}`}
          </p>
        </div>
        <button type="button" onClick={onClear} className="text-blue-600 hover:underline dark:text-blue-400">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        placeholder={placeholder ?? `Search ${type}…`}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          setAdding(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // While the quick-add form is open, its own Name/Phone fields legitimately steal
          // focus (they're real inputs, not mousedown-guarded buttons) — don't let that blur
          // close the dropdown out from under the user mid-fill.
          if (adding) return;
          setTimeout(() => setOpen(false), 150);
        }}
        className={inputClass}
      />
      {open && data && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {adding ? (
            <QuickAddForm
              type={type}
              initialName={search}
              onCreated={(party) => {
                onSelect(party);
                setSearch("");
                setOpen(false);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <>
              {!search && (
                <p className="border-b border-gray-100 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  Recent {type}s
                </p>
              )}
              <ul className="max-h-52 overflow-auto">
                {data.data.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No matching {type}s</li>}
                {data.data.map((party) => (
                  <li key={party.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelect(party);
                        setSearch("");
                        setOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                    >
                      {party.name} <span className="text-gray-400">— {formatCurrency(Number(party.cachedBalance))}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {search && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-700"
                >
                  <UserPlus size={15} />
                  Add "{search}" as new {type}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
