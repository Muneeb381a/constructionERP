import { useQuery } from "@tanstack/react-query";
import { Loader } from "../../components/Loader";
import { listPlatformAuditLog } from "../lib/platformAdminApi";

const ACTION_LABELS: Record<string, string> = {
  login: "Logged in",
  tenant_created: "Created shop",
  tenant_suspended: "Suspended shop",
  tenant_reactivated: "Reactivated shop",
  tenant_closed: "Closed shop",
};

export function PlatformAuditLogPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-admin-audit-log"],
    queryFn: () => listPlatformAuditLog(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Log</h1>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load audit log.</p>
      ) : !data || data.data.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Admin</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Shop</th>
                <th className="px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.data.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{entry.adminName ?? "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{entry.targetTenantName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{entry.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
