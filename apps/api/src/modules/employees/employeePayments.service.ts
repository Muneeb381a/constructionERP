import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { employeePayments } from "../../db/schema.js";
import { lockEmployee, recalculateEmployeeBalance } from "./employees.service.js";
import { postEmployeeLedgerEntry } from "./employeeLedger.service.js";
import type { CreateEmployeePaymentInput } from "./employees.schema.js";

export async function createEmployeePayment(
  ctx: { tenantId: string },
  employeeId: string,
  input: CreateEmployeePaymentInput,
) {
  const { tenantId } = ctx;

  const [existing] = await db
    .select()
    .from(employeePayments)
    .where(and(eq(employeePayments.tenantId, tenantId), eq(employeePayments.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) return { payment: existing, idempotentReplay: true };

  return db.transaction(async (tx) => {
    await lockEmployee(tx, tenantId, employeeId);

    const [payment] = await tx
      .insert(employeePayments)
      .values({
        tenantId,
        employeeId,
        method: input.method,
        amount: input.amount.toString(),
        isAdvance: input.isAdvance ?? false,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    await postEmployeeLedgerEntry(tx, {
      tenantId,
      employeeId,
      direction: "credit",
      amount: input.amount,
      sourceType: "payment",
      sourceId: payment.id,
    });

    await recalculateEmployeeBalance(tx, tenantId, employeeId);

    return { payment, idempotentReplay: false };
  });
}

export function listPaymentsForEmployee(tenantId: string, employeeId: string) {
  return db
    .select()
    .from(employeePayments)
    .where(and(eq(employeePayments.tenantId, tenantId), eq(employeePayments.employeeId, employeeId)))
    .orderBy(desc(employeePayments.createdAt));
}
