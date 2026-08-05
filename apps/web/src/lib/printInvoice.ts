import { fetchInvoicePdf } from "./api/invoices";

/** Fetches the invoice PDF and opens it in a new tab, ready for the cashier to Ctrl+P and
 * hand straight to the customer. Returns false (rather than throwing) on failure — a failed
 * fetch or a popup-blocked window shouldn't be treated as the sale/purchase itself failing,
 * since it already succeeded by the time this runs; callers show a manual retry button instead. */
export async function openInvoicePdf(invoiceId: string): Promise<boolean> {
  try {
    const blob = await fetchInvoicePdf(invoiceId);
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return !!opened;
  } catch {
    return false;
  }
}
