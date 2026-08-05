import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { useShopContext } from "../hooks/useShopContext";
import {
  createEmployee,
  deleteEmployee,
  getTodayAttendance,
  listEmployees,
  markAttendance,
  updateEmployee,
  type AttendanceStatus,
  type Employee,
  type EmployeeInput,
} from "../lib/api/employees";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; className: string }[] = [
  { value: "present", label: "P", className: "bg-green-600 text-white" },
  { value: "half_day", label: "½", className: "bg-amber-500 text-white" },
  { value: "absent", label: "A", className: "bg-red-600 text-white" },
  { value: "leave", label: "L", className: "bg-gray-400 text-white" },
];

function TodayAttendanceCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["employees-today-attendance"], queryFn: getTodayAttendance });

  const mutation = useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: string; status: AttendanceStatus }) =>
      markAttendance(employeeId, { date: data!.date, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees-today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  if (isLoading) return <Loader />;
  if (!data || data.employees.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today's Attendance</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">{data.date}</span>
      </div>
      <div className="space-y-2">
        {data.employees.map((emp) => (
          <div key={emp.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{emp.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{emp.designation ?? emp.employmentType.replace("_", " ")}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = emp.todayAttendance?.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    title={opt.value.replace("_", " ")}
                    onClick={() => mutation.mutate({ employeeId: emp.id, status: opt.value })}
                    disabled={mutation.isPending}
                    className={`h-7 w-7 rounded-full text-xs font-semibold transition ${
                      isActive ? opt.className : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptyForm: EmployeeInput = {
  branchId: "",
  name: "",
  phone: "",
  cnic: "",
  designation: "",
  employmentType: "daily_wage",
  dailyWageRate: 0,
  monthlySalary: 0,
  joiningDate: null,
};

function EmployeeForm({ editing, onDone }: { editing?: Employee; onDone: () => void }) {
  const queryClient = useQueryClient();
  const shop = useShopContext();
  const [form, setForm] = useState<EmployeeInput>(
    editing
      ? {
          branchId: editing.branchId,
          name: editing.name,
          phone: editing.phone,
          cnic: editing.cnic,
          designation: editing.designation,
          employmentType: editing.employmentType,
          dailyWageRate: Number(editing.dailyWageRate),
          monthlySalary: Number(editing.monthlySalary),
          joiningDate: editing.joiningDate,
        }
      : emptyForm,
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => (editing ? updateEmployee(editing.id, form) : createEmployee({ ...form, branchId: shop.branchId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees-today-attendance"] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? `Failed to ${editing ? "update" : "add"} employee`),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Name</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Phone</label>
          <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Designation</label>
          <input
            placeholder="Driver, Loader, Helper…"
            value={form.designation ?? ""}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Employment Type</label>
        <select
          value={form.employmentType}
          onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentTypeValue })}
          className={inputClass}
        >
          <option value="daily_wage">Daily Wage</option>
          <option value="monthly">Monthly Salary</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {form.employmentType === "daily_wage" ? (
          <div>
            <label className={labelClass}>Daily Wage Rate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.dailyWageRate}
              onChange={(e) => setForm({ ...form, dailyWageRate: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Monthly Salary</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.monthlySalary}
              onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label className={labelClass}>Joining Date</label>
          <input
            type="date"
            value={form.joiningDate ?? ""}
            onChange={(e) => setForm({ ...form, joiningDate: e.target.value || null })}
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : editing ? "Save Changes" : "Add Employee"}
        </button>
      </div>
    </form>
  );
}

type EmploymentTypeValue = Employee["employmentType"];

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === "owner" || role === "manager";
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [modal, setModal] = useState<null | { mode: "edit"; employee: Employee } | { mode: "delete"; employee: Employee }>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: employees, isLoading, isError } = useQuery({
    queryKey: ["employees", search, showInactive],
    queryFn: () => listEmployees({ search: search || undefined, includeInactive: showInactive }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateEmployee(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setModal(null);
    },
    onError: (err) => setDeleteError(axiosErrorMessage(err) ?? "Failed to delete employee"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Employees</h1>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Add Employee
          </button>
        )}
      </div>

      {canManage && <TodayAttendanceCard />}

      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass + " max-w-sm"}
        />
        {canManage && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        )}
      </div>

      {isLoading ? (
        <Loader />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load employees. Try refreshing.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Designation</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Balance Owed</th>
                {canManage && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {employees?.map((emp) => (
                <tr key={emp.id} className={!emp.isActive ? "opacity-50" : undefined}>
                  <td className="px-4 py-2">
                    <Link to={`/employees/${emp.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                      {emp.name}
                    </Link>
                    {!emp.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{emp.designation ?? "—"}</td>
                  <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{emp.employmentType.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {emp.employmentType === "daily_wage" ? `${formatCurrency(Number(emp.dailyWageRate))}/day` : `${formatCurrency(Number(emp.monthlySalary))}/mo`}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(Number(emp.cachedBalance))}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setModal({ mode: "edit", employee: emp })}
                          title="Edit"
                          className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
                        >
                          <Pencil size={15} />
                        </button>
                        {emp.isActive ? (
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: emp.id, isActive: false })}
                            title="Deactivate"
                            className="text-gray-400 hover:text-amber-600 dark:text-gray-500 dark:hover:text-amber-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: emp.id, isActive: true })}
                            title="Reactivate"
                            className="text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {employees?.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No employees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Employee" onClose={() => setShowAdd(false)}>
          <EmployeeForm onDone={() => setShowAdd(false)} />
        </Modal>
      )}

      {modal?.mode === "edit" && (
        <Modal title="Edit Employee" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <EmployeeForm editing={modal.employee} onDone={() => setModal(null)} />
            <div className="border-t border-gray-100 pt-3 text-right dark:border-gray-800">
              <button
                onClick={() => {
                  setDeleteError(null);
                  setModal({ mode: "delete", employee: modal.employee });
                }}
                className="text-xs text-red-500 hover:text-red-700 hover:underline dark:text-red-400"
              >
                Delete this employee permanently
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.mode === "delete" && (
        <ConfirmDialog
          title="Delete Employee"
          message={`"${modal.employee.name}" will be permanently removed. This only works if they have no attendance, payments, or salary history — otherwise it'll fail and you should deactivate them instead.`}
          confirmLabel="Delete"
          pending={deleteMutation.isPending}
          error={deleteError}
          onCancel={() => setModal(null)}
          onConfirm={() => deleteMutation.mutate(modal.employee.id)}
        />
      )}
    </div>
  );
}
