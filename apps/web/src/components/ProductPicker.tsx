import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts, type Product } from "../lib/api/products";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";

export function ProductPicker({
  onSelect,
  initialSearch,
}: {
  onSelect: (product: Product) => void;
  initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["product-search", search],
    queryFn: () => listProducts({ search }),
    enabled: search.length > 0,
  });

  return (
    <div className="relative">
      <input
        placeholder="Search product to add…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inputClass}
      />
      {open && search && data && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {data.data.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No matching products</li>}
          {data.data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(p);
                  setSearch("");
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                {p.name} <span className="text-gray-400">— {formatCurrency(Number(p.salePrice))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
