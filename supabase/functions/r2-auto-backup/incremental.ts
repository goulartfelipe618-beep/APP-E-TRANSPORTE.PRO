export function toBackupIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function rowBackupStamp(row: Record<string, unknown>): string | null {
  const updated = toBackupIso(row.updated_at);
  const created = toBackupIso(row.created_at);
  if (updated && created) return updated > created ? updated : created;
  return updated ?? created;
}

export function maxBackupStamp(rows: Record<string, unknown>[]): string | null {
  let max: string | null = null;
  for (const row of rows) {
    const stamp = rowBackupStamp(row);
    if (stamp && (!max || stamp > max)) max = stamp;
  }
  return max;
}

export function nextBackupCursor(previous: string | null, rowsSeen: Record<string, unknown>[]): string | null {
  const max = maxBackupStamp(rowsSeen);
  if (max && previous) return max > previous ? max : previous;
  return max ?? previous;
}

export function incrementFileName(relCsv: string, runStamp: string): string {
  const safe = relCsv.replace(/\.csv$/i, "");
  return `${safe}/incrementos/${runStamp}.csv`;
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
  if (size <= 0) return [rows];
  if (rows.length <= size) return rows.length ? [rows] : [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function runStampSp(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${pick("day")}.${pick("month")}.${pick("year")}_${pick("hour")}${pick("minute")}${pick("second")}`;
}
