import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Modal } from "../components/Modal";
import { Loader } from "../components/Loader";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { buildEmployeeWageMessage, buildWhatsAppLink } from "../lib/whatsapp";
import { useAuthStore } from "../store/authStore";
import {
  createEmployeePayment,
  getEmployee,
  listAttendance,
  listEmployeeLedger,
  listEmployeePayments,
  markAttendance,
  postSalary,
  type AttendanceStatus,
  type CreateEmployeePaymentInput,
} from "../lib/api/employees";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  half_day: "Half Day",
  absent: "Absent",
  leave: "Leave",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  half_day: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  absent: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  leave: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-green-500",
  half_day: "bg-amber-500",
  absent: "bg-red-500",
  leave: "bg-gray-400",
};

function todayIso() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}

function MarkAttendanceForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => markAttendance(employeeId, { date, status, note: note || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-attendance", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-ledger", employeeId] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to mark attendance"),
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
        <label className={labelClass}>Date</label>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} className={inputClass}>
          <option value="present">Present</option>
          <option value="half_day">Half Day</option>
          <option value="absent">Absent</option>
          <option value="leave">Leave</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function RecordEmployeePaymentForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [amount, setAmount] = useState(0);
  const [isAdvance, setIsAdvance] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateEmployeePaymentInput) => createEmployeePayment(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-ledger", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-payments", employeeId] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to record payment"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ idempotencyKey: crypto.randomUUID(), method, amount, isAdvance, note: note || null });
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputClass}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />
        This is an advance
      </label>
      <div>
        <label className={labelClass}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Record Payment"}
        </button>
      </div>
    </form>
  );
}

function PostSalaryForm({ employeeId, defaultAmount, onDone }: { employeeId: string; defaultAmount: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  const [amount, setAmount] = useState(defaultAmount);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => postSalary(employeeId, { month, amount, note: note || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-ledger", employeeId] });
      onDone();
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to post salary"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Posts (or corrects) this month's salary as owed. Re-posting the same month adjusts by the difference — it never duplicates.
      </p>
      <div>
        <label className={labelClass}>Month</label>
        <input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Saving…" : "Post Salary"}
        </button>
      </div>
    </form>
  );
}

function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const from = ymd(year, month, 1);
  const to = ymd(year, month, daysInMonth);

  const { data } = useQuery({
    queryKey: ["employee-attendance-range", employeeId, from, to],
    queryFn: () => listAttendance(employeeId, { from, to }),
  });

  const byDate = new Map((data ?? []).map((a) => [a.date, a]));
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(month + 1);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} aria-label="Previous month" className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          ‹
        </button>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{monthLabel}</p>
        <button onClick={nextMonth} aria-label="Next month" className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400 dark:text-gray-500">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} />;
          const dateStr = ymd(year, month, day);
          const att = byDate.get(dateStr);
          return (
            <div
              key={i}
              title={att ? `${dateStr}: ${STATUS_LABELS[att.status]}` : dateStr}
              className={`flex aspect-square items-center justify-center rounded text-[11px] ${
                att ? `${STATUS_DOT[att.status]} font-medium text-white` : "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
        {(Object.keys(STATUS_DOT) as AttendanceStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === "owner" || role === "manager";
  const [modal, setModal] = useState<null | "attendance" | "payment" | "salary">(null);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id!),
    enabled: !!id,
  });

  const { data: attendance } = useQuery({
    queryKey: ["employee-attendance", id],
    queryFn: () => listAttendance(id!),
    enabled: !!id,
  });

  const { data: ledger } = useQuery({
    queryKey: ["employee-ledger", id],
    queryFn: () => listEmployeeLedger(id!),
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["employee-payments", id],
    queryFn: () => listEmployeePayments(id!),
    enabled: !!id,
  });

  if (isLoading || !employee) return <Loader full />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/employees" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to Employees
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{employee.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {employee.designation ?? "—"} · {employee.employmentType === "daily_wage" ? "Daily Wage" : "Monthly Salary"}
              {employee.phone && ` · ${employee.phone}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(Number(employee.cachedBalance))}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">owed to employee</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canManage && employee.employmentType === "daily_wage" && (
          <button onClick={() => setModal("attendance")} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            Mark Attendance
          </button>
        )}
        {canManage && employee.employmentType === "monthly" && (
          <button onClick={() => setModal("salary")} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            Post Salary
          </button>
        )}
        {canManage && (
          <button onClick={() => setModal("payment")} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Record Payment
          </button>
        )}
        {employee.phone && Number(employee.cachedBalance) > 0 && (
          <a
            href={buildWhatsAppLink(employee.phone, buildEmployeeWageMessage(employee.name, formatCurrency(Number(employee.cachedBalance))))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            <MessageCircle size={15} />
            Send Wage Update
          </a>
        )}
      </div>

      {employee.employmentType === "daily_wage" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Attendance Calendar</h2>
          <AttendanceCalendar employeeId={id!} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Attendance History</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Wage</th>
                <th className="px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {attendance?.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{a.date}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(a.wageAmount))}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{a.note ?? "—"}</td>
                </tr>
              ))}
              {attendance?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No attendance recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Payments</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments?.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{p.method.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(p.amount))}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.isAdvance ? "Advance" : "Wage"}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.note ?? "—"}</td>
                </tr>
              ))}
              {payments?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Ledger History</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Direction</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {ledger?.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-400">{entry.sourceType.replace("_", " ")}</td>
                  <td className="px-4 py-2">
                    <span className={entry.direction === "debit" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                      {entry.direction}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(entry.amount))}</td>
                </tr>
              ))}
              {ledger?.entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    No ledger history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal === "attendance" && (
        <Modal title="Mark Attendance" onClose={() => setModal(null)}>
          <MarkAttendanceForm employeeId={id!} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "payment" && (
        <Modal title="Record Payment" onClose={() => setModal(null)}>
          <RecordEmployeePaymentForm employeeId={id!} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "salary" && (
        <Modal title="Post Monthly Salary" onClose={() => setModal(null)}>
          <PostSalaryForm employeeId={id!} defaultAmount={Number(employee.monthlySalary)} onDone={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
