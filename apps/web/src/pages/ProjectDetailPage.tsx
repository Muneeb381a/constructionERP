import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { HardHat } from "lucide-react";
import { Loader } from "../components/Loader";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { getProject, updateProjectStatus, type Project } from "../lib/api/projects";

function ProgressBar({ percent }: { percent: number }) {
  const capped = Math.min(100, percent);
  const color = percent >= 100 ? "bg-green-500" : percent >= 60 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${capped}%` }} />
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === "owner" || role === "manager";
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id!), enabled: !!id });

  const statusMutation = useMutation({
    mutationFn: (status: Project["status"]) => updateProjectStatus(id!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", id] }),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to update status"),
  });

  if (isLoading) return <Loader full />;
  if (isError || !data) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load this project. Try refreshing.</p>;

  const { project, invoices, progress } = data;

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Back to Projects
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <HardHat size={18} className="text-gray-400" />
            {project.name}
          </h1>
          {project.address && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{project.address}</p>}
        </div>
        {canManage ? (
          <select
            value={project.status}
            onChange={(e) => {
              setError(null);
              statusMutation.mutate(e.target.value as Project["status"]);
            }}
            disabled={statusMutation.isPending}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        ) : (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
            {project.status.replace("_", " ")}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {project.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{project.notes}</p>}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Material Progress</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {progress.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No material plan or sales recorded for this project yet.</p>
          ) : (
            <div className="space-y-4">
              {progress.map((line) => {
                const percent = line.targetQuantity ? (line.suppliedQuantity / line.targetQuantity) * 100 : 0;
                return (
                  <div key={line.productId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{line.productName}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {line.suppliedQuantity} {line.targetQuantity != null ? `of ${line.targetQuantity}` : "(not in plan)"} {line.unitName}
                      </span>
                    </div>
                    {line.targetQuantity != null && <ProgressBar percent={percent} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Linked Invoices</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {invoices.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No sales linked to this project yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-2 font-medium">Invoice</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2.5">
                      <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(inv.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
