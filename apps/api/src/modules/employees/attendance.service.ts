import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { employeeAttendance, employees } from "../../db/schema.js";
import { lockEmployee, recalculateEmployeeBalance } from "./employees.service.js";
import { postEmployeeLedgerEntry } from "./employeeLedger.service.js";
import { karachiDateString } from "../../lib/timezone.js";
import type { ListAttendanceQuery, MarkAttendanceInput } from "./employees.schema.js";

function wageForStatus(status: MarkAttendanceInput["status"], dailyRate: number) {
  if (status === "present") return dailyRate;
  if (status === "half_day") return dailyRate / 2;
  return 0; // absent, leave
}

/**
 * Marks (or corrects) one employee's attendance for a given Asia/Karachi calendar day.
 * Present/half-day auto-posts that day's wage as a debit (business owes the employee more);
 * re-marking an already-recorded day posts only the *delta* as a correcting entry, so history
 * is never mutated or deleted — same append-only philosophy as the party ledger.
 */
export async function markAttendance(
  ctx: { tenantId: string; markedBy: string },
  employeeId: string,
  input: MarkAttendanceInput,
) {
  const { tenantId, markedBy } = ctx;

  return db.transaction(async (tx) => {
    const employee = await lockEmployee(tx, tenantId, employeeId);
    const dailyRate = employee.employmentType === "daily_wage" ? Number(employee.dailyWageRate ?? 0) : 0;
    const newWage = wageForStatus(input.status, dailyRate);

    const [existing] = await tx
      .select()
      .from(employeeAttendance)
      .where(and(eq(employeeAttendance.employeeId, employeeId), eq(employeeAttendance.date, input.date)))
      .limit(1);

    let attendanceRow;
    if (existing) {
      [attendanceRow] = await tx
        .update(employeeAttendance)
        .set({ status: input.status, wageAmount: newWage.toString(), note: input.note ?? null, markedBy })
        .where(eq(employeeAttendance.id, existing.id))
        .returning();

      const delta = newWage - Number(existing.wageAmount ?? 0);
      if (delta !== 0) {
        await postEmployeeLedgerEntry(tx, {
          tenantId,
          employeeId,
          direction: delta > 0 ? "debit" : "credit",
          amount: Math.abs(delta),
          sourceType: "attendance_correction",
          sourceId: attendanceRow.id,
        });
      }
    } else {
      [attendanceRow] = await tx
        .insert(employeeAttendance)
        .values({
          tenantId,
          employeeId,
          date: input.date,
          status: input.status,
          wageAmount: newWage.toString(),
          note: input.note ?? null,
          markedBy,
        })
        .returning();

      if (newWage > 0) {
        await postEmployeeLedgerEntry(tx, {
          tenantId,
          employeeId,
          direction: "debit",
          amount: newWage,
          sourceType: "attendance_wage",
          sourceId: attendanceRow.id,
        });
      }
    }

    await recalculateEmployeeBalance(tx, tenantId, employeeId);
    return attendanceRow;
  });
}

export function listAttendanceForEmployee(tenantId: string, employeeId: string, query: ListAttendanceQuery) {
  const conditions = [eq(employeeAttendance.tenantId, tenantId), eq(employeeAttendance.employeeId, employeeId)];
  if (query.from) conditions.push(gte(employeeAttendance.date, query.from));
  if (query.to) conditions.push(lte(employeeAttendance.date, query.to));

  return db
    .select()
    .from(employeeAttendance)
    .where(and(...conditions))
    .orderBy(desc(employeeAttendance.date));
}

/** All active employees plus (if marked) today's attendance status — powers the "mark today" quick-action list. */
export async function listTodayAttendance(tenantId: string) {
  const today = karachiDateString();

  const rows = await db
    .select({ employee: employees, attendance: employeeAttendance })
    .from(employees)
    .leftJoin(
      employeeAttendance,
      and(eq(employeeAttendance.employeeId, employees.id), eq(employeeAttendance.date, today)),
    )
    .where(and(eq(employees.tenantId, tenantId), eq(employees.isActive, true)))
    .orderBy(employees.name);

  return { date: today, employees: rows.map((r) => ({ ...r.employee, todayAttendance: r.attendance ?? null })) };
}
