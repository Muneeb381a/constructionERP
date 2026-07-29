/** A reminder is "due" if none was ever sent, or the last one predates the shop's
 * configured interval (Settings → Preferences, default 7 days). */
export function isReminderDue(lastReminderSentAt: string | null, intervalDays: number): boolean {
  if (!lastReminderSentAt) return true;
  const daysSince = (Date.now() - new Date(lastReminderSentAt).getTime()) / 86_400_000;
  return daysSince >= intervalDays;
}
