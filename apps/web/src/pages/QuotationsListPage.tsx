import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { inputClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { Loader } from "../components/Loader";
import { listQuotations, type QuotationStatus } from "../lib/api/quotations";

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  accepted: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  converted: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

export function QuotationsListPage() {
  const [status, setStatus] = useState<QuotationStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["quotations", status, page],
    queryFn: () => listQuotations({ status: status || undefined, page }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quotations</h1>
        <Link to="/quotations/new" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          New Quotation
        </Link>
      </div>

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as QuotationStatus | "");
          setPage(1);
        }}
        className={inputClass + " max-w-48"}
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="accepted">Accepted</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
        <option value="converted">Converted</option>
      </select>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Quotation No</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.data.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2">
                      <Link to={`/quotations/${q.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {q.quotationNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(q.totalAmount))}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[q.status]}`}>{q.status}</span>
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No quotations found.
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
