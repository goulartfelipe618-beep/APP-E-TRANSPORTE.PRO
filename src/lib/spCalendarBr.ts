/**
 * Chaves de calendário em America/Sao_Paulo (limites por dia/mês no Brasil).
 */

export function calendarDayKeySaoPauloFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function todayKeySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function yearMonthKeySaoPauloFromDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function yearMonthKeySaoPauloFromIso(iso: string): string {
  return yearMonthKeySaoPauloFromDate(new Date(iso));
}

export function currentYearMonthKeySaoPaulo(): string {
  return yearMonthKeySaoPauloFromDate(new Date());
}
