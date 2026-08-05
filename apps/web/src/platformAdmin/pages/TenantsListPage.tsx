import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Loader } from "../../components/Loader";
import { inputClass } from "../../lib/formStyles";
import { listTenants, type TenantStatus } from "../lib/platformAdminApi";

const STATUS_STYLES: Record<TenantStatus, string> = {
  active: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  suspended: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  closed: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export function TenantsListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantStatus | "">("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-admin-tenants", search, status],
    queryFn: () => listTenants({ search: search || undefined, status: status || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shops</h1>
        <Link
          to="/platform-admin/tenants/new"
          className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400"
        >
          <Plus size={16} />
          Create Shop
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business name…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as TenantStatus | "")} className={inputClass}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load shops.</p>
      ) : !data || data.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No shops yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5">Business</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.data.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/platform-admin/tenants/${tenant.id}`}
                      className="font-medium text-gray-900 hover:underline dark:text-gray-100"
                    >
                      {tenant.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                    {tenant.ownerName ? (
                      <>
                        {tenant.ownerName}
                        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({tenant.ownerEmail})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[tenant.status]}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
