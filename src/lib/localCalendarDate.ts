/**
 * Calendar date YYYY-MM-DD in the user's local timezone (not UTC).
 * Use when comparing with Postgres `date` fields filled from date inputs, so expiry logic matches the user's calendar day.
 */
export function getLocalDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
