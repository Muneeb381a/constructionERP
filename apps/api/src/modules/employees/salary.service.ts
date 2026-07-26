import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { employeeSalaryPostings } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { lockEmployee, recalculateEmployeeBalance } from "./employees.service.js";
import { postEmployeeLedgerEntry } from "./employeeLedger.service.js";
import type { PostSalaryInput } from "./employees.schema.js";

/**
 * Posts (or corrects) one month's salary as a ledger debit for a monthly-salary employee.
 * Re-posting an already-posted month posts only the delta as a correcting entry — same
 * append-only philosophy as attendance wage postings, never mutating history.
 */
export async function postMonthlySalary(
  ctx: { tenantId: string; postedBy: string },
  employeeId: string,
  input: PostSalaryInput,
) {
  const { tenantId, postedBy } = ctx;

  return db.transaction(async (tx) => {
    const employee = await lockEmployee(tx, tenantId, employeeId);
    if (employee.employmentType !== "monthly") {
      throw new HttpError(400, "Only monthly-salary employees can have salary posted this way — daily-wage employees earn via attendance");
    }

    const [existing] = await tx
      .select()
      .from(employeeSalaryPostings)
      .where(and(eq(employeeSalaryPostings.employeeId, employeeId), eq(employeeSalaryPostings.month, input.month)))
      .limit(1);

    let posting;
    if (existing) {
      [posting] = await tx
        .update(employeeSalaryPostings)
        .set({ amount: input.amount.toString(), note: input.note ?? null, postedBy })
        .where(eq(employeeSalaryPostings.id, existing.id))
        .returning();

      const delta = input.amount - Number(existing.amount);
      if (delta !== 0) {
        await postEmployeeLedgerEntry(tx, {
          tenantId,
          employeeId,
          direction: delta > 0 ? "debit" : "credit",
          amount: Math.abs(delta),
          sourceType: "salary_correction",
          sourceId: posting.id,
        });
      }
    } else {
      [posting] = await tx
        .insert(employeeSalaryPostings)
        .values({ tenantId, employeeId, month: input.month, amount: input.amount.toString(), note: input.note ?? null, postedBy })
        .returning();

      if (input.amount > 0) {
        await postEmployeeLedgerEntry(tx, {
          tenantId,
          employeeId,
          direction: "debit",
          amount: input.amount,
          sourceType: "monthly_salary",
          sourceId: posting.id,
        });
      }
    }

    await recalculateEmployeeBalance(tx, tenantId, employeeId);
    return posting;
  });
}

export function listSalaryPostings(tenantId: string, employeeId: string) {
  return db
    .select()
    .from(employeeSalaryPostings)
    .where(and(eq(employeeSalaryPostings.tenantId, tenantId), eq(employeeSalaryPostings.employeeId, employeeId)))
    .orderBy(desc(employeeSalaryPostings.month));
}
