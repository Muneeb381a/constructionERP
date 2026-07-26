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
