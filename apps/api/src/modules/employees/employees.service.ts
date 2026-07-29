import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { employeeLedgerEntries, employees } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { pgErrorCode } from "../../lib/pgError.js";
import type { CreateEmployeeInput, ListEmployeesQuery, UpdateEmployeeInput } from "./employees.schema.js";

/** Locks the employee row for the caller's transaction — mirrors parties.lockParty, so
 * concurrent attendance marks / payments against the same employee can't race past a stale balance. */
export async function lockEmployee(tx: DbOrTx, tenantId: string, employeeId: string) {
  const [employee] = await tx
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .for("update");
  if (!employee) throw new HttpError(400, "employeeId does not refer to an employee in this tenant");
  return employee;
}

/** Re-sums employee_ledger_entries and overwrites employees.cachedBalance — the only way that column is ever set. */
export async function recalculateEmployeeBalance(executor: DbOrTx, tenantId: string, employeeId: string) {
  const [row] = await executor
    .select({
      debit: sql<string>`coalesce(sum(case when ${employeeLedgerEntries.direction} = 'debit' then ${employeeLedgerEntries.amount} else 0 end), 0)`,
      credit: sql<string>`coalesce(sum(case when ${employeeLedgerEntries.direction} = 'credit' then ${employeeLedgerEntries.amount} else 0 end), 0)`,
    })
    .from(employeeLedgerEntries)
    .where(and(eq(employeeLedgerEntries.tenantId, tenantId), eq(employeeLedgerEntries.employeeId, employeeId)));

  const balance = Number(row?.debit ?? 0) - Number(row?.credit ?? 0);

  await executor
    .update(employees)
    .set({ cachedBalance: balance.toString(), balanceUpdatedAt: new Date() })
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)));

  return balance;
}

export async function listEmployees(tenantId: string, query: ListEmployeesQuery) {
  const conditions = [eq(employees.tenantId, tenantId)];
  if (!query.includeInactive) conditions.push(eq(employees.isActive, true));
  if (query.search) {
    conditions.push(
      or(ilike(employees.name, `%${query.search}%`), ilike(employees.phone, `%${query.search}%`), ilike(employees.designation, `%${query.search}%`))!,
    );
  }

  return db
    .select()
    .from(employees)
    .where(and(...conditions))
    .orderBy(desc(employees.createdAt));
}

export async function getEmployee(tenantId: string, employeeId: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);
  if (!employee) throw new HttpError(404, "Employee not found");
  return employee;
}

export async function createEmployee(tenantId: string, input: CreateEmployeeInput) {
  const [employee] = await db
    .insert(employees)
    .values({
      tenantId,
      branchId: input.branchId,
      name: input.name,
      phone: input.phone ?? null,
      cnic: input.cnic ?? null,
      designation: input.designation ?? null,
      employmentType: input.employmentType,
      dailyWageRate: input.dailyWageRate?.toString() ?? "0",
      monthlySalary: input.monthlySalary?.toString() ?? "0",
      joiningDate: input.joiningDate ?? null,
    })
    .returning();
  return employee;
}

export async function updateEmployee(tenantId: string, employeeId: string, input: UpdateEmployeeInput) {
  const [updated] = await db
    .update(employees)
    .set({
      ...input,
      dailyWageRate: input.dailyWageRate != null ? input.dailyWageRate.toString() : undefined,
      monthlySalary: input.monthlySalary != null ? input.monthlySalary.toString() : undefined,
    })
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .returning();

  if (!updated) throw new HttpError(404, "Employee not found");
  return updated;
}

export async function deleteEmployee(tenantId: string, employeeId: string) {
  try {
    const [deleted] = await db
      .delete(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .returning({ id: employees.id });
    if (!deleted) throw new HttpError(404, "Employee not found");
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (pgErrorCode(err) === "23503") {
      throw new HttpError(409, "Employee has attendance or payment history — deactivate instead of deleting");
    }
    throw err;
  }
}
