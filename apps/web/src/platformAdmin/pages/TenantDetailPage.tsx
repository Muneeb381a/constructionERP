import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { Loader } from "../../components/Loader";
import { axiosErrorMessage } from "../../lib/errors";
import { TypeToConfirmDialog } from "../components/TypeToConfirmDialog";
import { closeTenant, getTenantDetail, reactivateTenant, suspendTenant } from "../lib/platformAdminApi";

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"suspend" | "close" | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-admin-tenant", tenantId],
    queryFn: () => getTenantDetail(tenantId!),
    enabled: !!tenantId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform-admin-tenant", tenantId] });

  const suspendMutation = useMutation({
    mutationFn: () => suspendTenant(tenantId!, reason || undefined),
    onSuccess: () => {
      invalidate();
      setAction(null);
      setReason("");
    },
  });
  const reactivateMutation = useMutation({
    mutationFn: () => reactivateTenant(tenantId!),
    onSuccess: invalidate,
  });
  const closeMutation = useMutation({
    mutationFn: () => closeTenant(tenantId!, reason || undefined),
    onSuccess: () => {
      invalidate();
      setAction(null);
      setReason("");
    },
  });

  if (isLoading) return <Loader />;
  if (isError || !data) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load shop.</p>;

  const { tenant, users, liveDevices, metrics } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tenant.businessName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Created {new Date(tenant.createdAt).toLocaleDateString()} · {metrics.invoiceCount} invoices
          </p>
        </div>
        <div className="flex gap-2">
          {tenant.status === "active" && (
            <button
              onClick={() => setAction("suspend")}
              className="flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10"
            >
              <PauseCircle size={15} />
              Suspend
            </button>
          )}
          {tenant.status === "suspended" && (
            <button
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              className="flex items-center gap-1.5 rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-500/30 dark:text-green-400 dark:hover:bg-green-500/10"
            >
              <PlayCircle size={15} />
              Reactivate
            </button>
          )}
          {tenant.status !== "closed" && (
            <button
              onClick={() => setAction("close")}
              className="flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <XCircle size={15} />
              Close permanently
            </button>
          )}
        </div>
      </div>

      {tenant.status === "suspended" && tenant.suspendedReason && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Suspended: {tenant.suspendedReason}
        </p>
      )}
      {tenant.status === "closed" && tenant.closedReason && (
        <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Closed: {tenant.closedReason}
        </p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Users</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.email}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.role}</td>
                  <td className="px-4 py-2.5">{u.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Laptop size={15} />
          Live devices ({liveDevices.length})
        </h2>
        {liveDevices.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No devices currently logged in.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Device / Browser</th>
                  <th className="px-4 py-2.5">IP</th>
                  <th className="px-4 py-2.5">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {liveDevices.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{d.userName}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-gray-600 dark:text-gray-400" title={d.userAgent ?? ""}>
                      {d.userAgent ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{d.ipAddress ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{timeAgo(d.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {action === "suspend" && (
        <TypeToConfirmDialog
          title="Suspend shop"
          message={`This immediately signs out every device logged into "${tenant.businessName}" and blocks their staff from logging back in until reactivated.`}
          confirmWord={tenant.businessName}
          confirmLabel="Suspend"
          extraField={{ label: "Reason (optional, for your records)", value: reason, onChange: setReason }}
          pending={suspendMutation.isPending}
          error={axiosErrorMessage(suspendMutation.error)}
          onConfirm={() => suspendMutation.mutate()}
          onCancel={() => {
            setAction(null);
            setReason("");
          }}
        />
      )}
      {action === "close" && (
        <TypeToConfirmDialog
          title="Close shop permanently"
          message={`This permanently closes "${tenant.businessName}". All their data is kept, but nobody can log in again — this cannot be undone from here.`}
          confirmWord={tenant.businessName}
          confirmLabel="Close permanently"
          extraField={{ label: "Reason (optional, for your records)", value: reason, onChange: setReason }}
          pending={closeMutation.isPending}
          error={axiosErrorMessage(closeMutation.error)}
          onConfirm={() => closeMutation.mutate()}
          onCancel={() => {
            setAction(null);
            setReason("");
          }}
        />
      )}
    </div>
  );
}
