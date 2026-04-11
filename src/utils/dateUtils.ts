/** Normalize to YYYY-MM-DD (UTC date part of ISO string). */
export function toDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toISOString().slice(0, 10);
}

export function parseDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

/** Random ISO timestamp on that calendar day (UTC). */
export function randomTimestampOnDay(dateKey: string): string {
  const base = parseDateKey(dateKey);
  const start = base.getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  const t = start + Math.floor(Math.random() * (end - start));
  return new Date(t).toISOString();
}

export function yearBoundsUtc(year: number): { from: string; to: string } {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return { from, to };
}

export function defaultSyncRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  return yearBoundsUtc(y);
}
