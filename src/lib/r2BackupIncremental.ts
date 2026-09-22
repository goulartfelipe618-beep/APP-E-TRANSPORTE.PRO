/** Cursor de backup incremental: só linhas novas ou alteradas depois do último envio. */

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

export function filterRowsSinceCursor(
  rows: Record<string, unknown>[],
  cursor: string | null,
): Record<string, unknown>[] {
  if (!cursor) return rows;
  return rows.filter((row) => {
    const stamp = rowBackupStamp(row);
    return Boolean(stamp && stamp > cursor);
  });
}

export function nextBackupCursor(
  previous: string | null,
  rowsSeen: Record<string, unknown>[],
): string | null {
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
