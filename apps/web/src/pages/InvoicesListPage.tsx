import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { Loader } from "../components/Loader";
import { exportToCsv } from "../lib/csv";
import { listInvoices, type Invoice } from "../lib/api/invoices";

const EXPORT_PAGE_LIMIT = 100;
const EXPORT_MAX_PAGES = 20; // caps a single export at 2,000 invoices — well beyond a small shop's needs

const TYPE_LABELS: Record<Invoice["type"], string> = {
  sale: "Sale",
  purchase: "Purchase",
  sale_return: "Sale Return",
  purchase_return: "Purchase Return",
};

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const styles =
    status === "void"
      ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}

export function InvoicesListPage() {
  const [type, setType] = useState<Invoice["type"] | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", type, dateFrom, dateTo, page],
    queryFn: () =>
      listInvoices({
        type: type || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  async function handleExport() {
    setExporting(true);
    try {
      const filters = { type: type || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
      const all: Invoice[] = [];
      for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
        const res = await listInvoices({ ...filters, page: p, limit: EXPORT_PAGE_LIMIT });
        all.push(...res.data);
        if (res.data.length < EXPORT_PAGE_LIMIT || all.length >= res.total) break;
      }
      exportToCsv(`invoices-${new Date().toISOString().slice(0, 10)}`, all, [
        { header: "Invoice No", value: (r) => r.invoiceNo },
        { header: "Customer/Supplier", value: (r) => r.partyName ?? "Walk-in" },
        { header: "Type", value: (r) => TYPE_LABELS[r.type] },
        { header: "Date", value: (r) => new Date(r.createdAt).toLocaleString() },
        { header: "Subtotal", value: (r) => r.subtotal },
        { header: "Discount", value: (r) => r.discount },
        { header: "Total", value: (r) => r.totalAmount },
        { header: "Status", value: (r) => r.status },
      ]);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Invoices</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Download size={15} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as Invoice["type"] | "");
            setPage(1);
          }}
          className={inputClass + " max-w-48"}
        >
          <option value="">All types</option>
          <option value="sale">Sale</option>
          <option value="purchase">Purchase</option>
          <option value="sale_return">Sale Return</option>
          <option value="purchase_return">Purchase Return</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className={inputClass + " max-w-44"}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className={inputClass + " max-w-44"}
        />
      </div>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Invoice No</th>
                  <th className="px-4 py-2 font-medium">Customer / Supplier</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.data.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2">
                      <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {inv.partyId ? (
                        <Link to={`/customers/${inv.partyId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                          {inv.partyName}
                        </Link>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Walk-in</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{TYPE_LABELS[inv.type]}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(inv.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(inv.totalAmount))}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              Page {data?.page ?? 1} of {totalPages} · {data?.total ?? 0} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
