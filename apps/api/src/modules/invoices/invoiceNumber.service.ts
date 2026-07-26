import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../../db/index.js";
import { invoiceNumberCounters } from "../../db/schema.js";
import { karachiYear } from "../../lib/timezone.js";

const PREFIX: Record<string, string> = {
  sale: "INV",
  purchase: "PUR",
  sale_return: "SRET",
  purchase_return: "PRET",
  quotation: "QUO",
};

export type InvoiceDocumentType = "sale" | "purchase" | "sale_return" | "purchase_return" | "quotation";

/**
 * Atomically allocates the next invoice number for (tenant, branch, type, year) by
 * locking the counter row with FOR UPDATE — never MAX(id)+1 in app code, which
 * duplicates numbers under concurrency.
 */
export async function generateInvoiceNumber(
  executor: DbOrTx,
  params: { tenantId: string; branchId: string; documentType: InvoiceDocumentType },
): Promise<string> {
  const year = karachiYear();
  const { tenantId, branchId, documentType } = params;

  let [counter] = await executor
    .select()
    .from(invoiceNumberCounters)
    .where(
      and(
        eq(invoiceNumberCounters.tenantId, tenantId),
        eq(invoiceNumberCounters.branchId, branchId),
        eq(invoiceNumberCounters.documentType, documentType),
        eq(invoiceNumberCounters.year, year),
      ),
    )
    .for("update");

  if (!counter) {
    [counter] = await executor
      .insert(invoiceNumberCounters)
      .values({ tenantId, branchId, documentType, year, lastNumber: 0 })
      .onConflictDoNothing({
        target: [
          invoiceNumberCounters.tenantId,
          invoiceNumberCounters.branchId,
          invoiceNumberCounters.documentType,
          invoiceNumberCounters.year,
        ],
      })
      .returning();

    if (!counter) {
      // lost the race to another concurrent invoice creation — re-select and lock it now
      [counter] = await executor
        .select()
        .from(invoiceNumberCounters)
        .where(
          and(
            eq(invoiceNumberCounters.tenantId, tenantId),
            eq(invoiceNumberCounters.branchId, branchId),
            eq(invoiceNumberCounters.documentType, documentType),
            eq(invoiceNumberCounters.year, year),
          ),
        )
        .for("update");
    }
  }

  const nextNumber = counter.lastNumber + 1;
  await executor
    .update(invoiceNumberCounters)
    .set({ lastNumber: nextNumber })
    .where(eq(invoiceNumberCounters.id, counter.id));

  const prefix = PREFIX[documentType];
  return `${prefix}-${year}-${String(nextNumber).padStart(6, "0")}`;
}
