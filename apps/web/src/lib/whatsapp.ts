import { formatCurrency } from "./format";

/** Normalizes a Pakistani phone number (03xx..., +923xx..., 923xx...) to the digits-only
 * international format wa.me expects (923xxxxxxxxx). Best-effort — falls back to the
 * stripped digits for anything already in another country's format. */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}

/** Builds a wa.me click-to-chat link — opens that contact's chat with the message
 * pre-filled in the input box. Nothing is sent automatically; the shop owner reviews
 * and hits send themselves. No WhatsApp Business API, no provider, no cost. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** @param balance already-formatted currency string (e.g. from formatCurrency) — includes its own symbol */
export function buildBalanceReminderMessage(partyName: string, balance: string): string {
  return `Assalam-o-Alaikum ${partyName}, yeh ek dosti yaad dahani hai: aap ka humare paas bakaya (outstanding) balance ${balance} hai. Barah-e-karam jald ada farmayein. Shukriya!`;
}

/**
 * Itemized version — lists exactly which bills are still pending (and how much of each),
 * not just the running total, so the customer can see what they're actually being asked
 * to pay for. Falls back to the plain total-only message when there's nothing to itemize
 * (e.g. an opening-balance-only account with no invoice history).
 */
export function buildBillReminderMessage(
  partyName: string,
  bills: { invoiceNo: string; date: string; balanceDue: number }[],
  totalBalance: string,
): string {
  const pending = bills.filter((b) => b.balanceDue > 0.01).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (pending.length === 0) {
    return buildBalanceReminderMessage(partyName, totalBalance);
  }

  const lines = pending.map((b) => {
    const date = new Date(b.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    return `• ${b.invoiceNo} (${date}): ${formatCurrency(b.balanceDue)}`;
  });

  return `Assalam-o-Alaikum ${partyName}, yeh ek dosti yaad dahani hai — neeche diye gaye bills abhi tak pending hain:\n\n${lines.join("\n")}\n\nKul bakaya (total outstanding): ${totalBalance}\n\nBarah-e-karam jald ada farmayein. Shukriya!`;
}

/** @param balance already-formatted currency string — includes its own symbol */
export function buildEmployeeWageMessage(employeeName: string, balance: string): string {
  return `Assalam-o-Alaikum ${employeeName}, aap ki mojooda wage/salary balance ${balance} hai jo aap ko dena baqi hai. Jald ada ki jaye gi. Shukriya!`;
}

/** Opens WhatsApp with no recipient pre-selected — the phone's own contact/group picker
 * opens instead, so the owner can send to whichever supplier, manager, or number fits. */
export function buildWhatsAppShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildLowStockAlertMessage(items: { name: string; currentStock: number; minStock: number }[]): string {
  const lines = items.map((i) => `• ${i.name}: ${i.currentStock} (min ${i.minStock})`);
  return `Assalam-o-Alaikum, in ${items.length} items ka stock reorder point se neeche hai:\n\n${lines.join("\n")}\n\nBarah-e-karam jald reorder karein.`;
}
