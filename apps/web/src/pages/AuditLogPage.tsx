import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { Loader } from "../components/Loader";
import { listAuditLog, type AuditLogEntry } from "../lib/api/audit";

const ACTION_LABELS: Record<string, string> = {
  invoice_void: "Invoice Voided",
  credit_limit_override: "Credit Limit Overridden",
  balance_reconciliation_mismatch: "Balance Reconciliation Mismatch",
};

function diffLine(before: string | null, after: string | null) {
  if (!before && !after) return null;
  try {
    const b = before ? JSON.parse(before) : {};
    const a = after ? JSON.parse(after) : {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    return keys.map((k) => `${k}: ${b[k] ?? "—"} → ${a[k] ?? "—"}`).join(" · ");
  } catch {
    return `${before ?? ""} → ${after ?? ""}`;
  }
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const summary = diffLine(entry.beforeData, entry.afterData);

  return (
    <tr className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(entry.createdAt).toLocaleString()}</td>
      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{entry.userName ?? "—"}</td>
      <td className="px-4 py-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
        {entry.entityType} <span className="text-gray-400 dark:text-gray-500">#{entry.entityId.slice(0, 8)}</span>
      </td>
      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
        {expanded ? <span className="whitespace-pre-wrap">{summary}</span> : <span className="truncate">{summary}</span>}
      </td>
    </tr>
  );
}

export function AuditLogPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canView = role === "owner" || role === "manager";
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => listAuditLog({ page }),
    enabled: canView,
  });

  if (!canView) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Audit log is available to owners and managers only.</p>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Log</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Sensitive actions across the account — voids, credit-limit overrides, and reconciliation flags.</p>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Entity</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.data.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      No audit events recorded yet.
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
