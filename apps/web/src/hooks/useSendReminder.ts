import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "../lib/format";
import { buildBillReminderMessage, buildWhatsAppLink } from "../lib/whatsapp";
import { markReminderSent } from "../lib/api/parties";
import { listPartyBills } from "../lib/api/payments";

/** Shared by every "Send Reminder" button in the app (Dashboard, Customers, Ledger, Customer
 * Detail) — builds the itemized WhatsApp message, opens it, and records lastReminderSentAt so
 * the "due for a reminder" scheduling elsewhere in the app stays accurate. */
export function useSendReminder() {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function sendReminder(party: { id: string; name: string; phone: string }, balance: number) {
    setLoadingId(party.id);
    try {
      const bills = await listPartyBills(party.id);
      const message = buildBillReminderMessage(
        party.name,
        bills.map((b) => ({ invoiceNo: b.invoice.invoiceNo, date: b.invoice.createdAt, balanceDue: b.balanceDue })),
        formatCurrency(balance),
      );
      window.open(buildWhatsAppLink(party.phone, message), "_blank", "noopener,noreferrer");
      await markReminderSent(party.id);
      queryClient.invalidateQueries({ queryKey: ["reports-aging"] });
      queryClient.invalidateQueries({ queryKey: ["party", party.id] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
    } finally {
      setLoadingId(null);
    }
  }

  return { sendReminder, loadingId };
}
