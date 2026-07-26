import { and, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { employeeLedgerEntries, employees } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";

export type EmployeeLedgerDirection = "debit" | "credit";

export type PostEmployeeLedgerEntryParams = {
  tenantId: string;
  employeeId: string;
  direction: EmployeeLedgerDirection;
  amount: number;
  sourceType: string; // attendance_wage, attendance_correction, payment, adjustment
  sourceId: string;
};

/** The only place employee_ledger_entries should ever be inserted from — mirrors ledger.service.ts's postLedgerEntry. */
export async function postEmployeeLedgerEntry(executor: DbOrTx, params: PostEmployeeLedgerEntryParams) {
  if (params.amount <= 0) throw new HttpError(400, "Ledger entry amount must be positive");

  const [employee] = await executor
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, params.employeeId), eq(employees.tenantId, params.tenantId)))
    .limit(1);
  if (!employee) throw new HttpError(400, "employeeId does not refer to an employee in this tenant");

  const [entry] = await executor
    .insert(employeeLedgerEntries)
    .values({
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      direction: params.direction,
      amount: params.amount.toString(),
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    })
    .returning();

  return entry;
}

export function listLedgerForEmployee(tenantId: string, employeeId: string) {
  return db
    .select()
    .from(employeeLedgerEntries)
    .where(and(eq(employeeLedgerEntries.tenantId, tenantId), eq(employeeLedgerEntries.employeeId, employeeId)))
    .orderBy(desc(employeeLedgerEntries.createdAt));
}
