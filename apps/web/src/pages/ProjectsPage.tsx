import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { HardHat, Plus } from "lucide-react";
import { Loader } from "../components/Loader";
import { listProjects } from "../lib/api/projects";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  completed: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  on_hold: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function ProjectsPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <HardHat size={18} className="text-gray-400" />
            Projects
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Group a customer's sales across one construction site — foundation today, walls next month.
          </p>
        </div>
        <Link
          to="/projects/new"
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={15} />
          New Project
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <Loader />
        ) : !projects || projects.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">No projects yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Address</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {projects.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2.5">
                    <Link to={`/projects/${p.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{p.address ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status]}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
