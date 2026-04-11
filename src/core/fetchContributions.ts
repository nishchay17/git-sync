import type { DailyContribution } from "../types/types.js";
import { parseDateKey, toDateKey } from "../utils/dateUtils.js";

const API_BASE = "https://github-contributions-api.jogruber.de/v4";

interface ContributionsApiDay {
  date: string;
  count: number;
  level: number;
}

interface ContributionsApiResponse {
  total?: Record<string, number>;
  contributions: ContributionsApiDay[];
}

function yearsSpanningRange(fromDate: string, toDate: string): number[] {
  const yStart = parseInt(fromDate.slice(0, 4), 10);
  const yEnd = parseInt(toDate.slice(0, 4), 10);
  if (Number.isNaN(yStart) || Number.isNaN(yEnd) || yStart > yEnd) return [];
  const years: number[] = [];
  for (let y = yStart; y <= yEnd; y++) years.push(y);
  return years;
}

async function fetchYear(username: string, year: number): Promise<ContributionsApiDay[]> {
  const url = `${API_BASE}/${encodeURIComponent(username)}?y=${year}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Contributions API request failed (${year}): ${msg}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Contributions API HTTP ${res.status} for year ${year}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }

  let data: ContributionsApiResponse;
  try {
    data = (await res.json()) as ContributionsApiResponse;
  } catch {
    throw new Error(`Contributions API returned invalid JSON for year ${year}`);
  }

  if (!Array.isArray(data.contributions)) {
    throw new Error(`Contributions API: missing contributions[] for year ${year}`);
  }

  return data.contributions;
}

/**
 * Fetches public contribution data via https://github-contributions-api.jogruber.de/ (no GitHub token).
 * Uses query param `y` per calendar year; merges when `from`–`to` spans multiple years.
 */
export async function fetchContributions(
  username: string,
  fromDate: string,
  toDate: string
): Promise<DailyContribution[]> {
  const years = yearsSpanningRange(fromDate, toDate);
  if (years.length === 0) {
    return [];
  }

  const byDay = new Map<string, number>();

  for (const year of years) {
    const days = await fetchYear(username, year);
    for (const row of days) {
      const key = toDateKey(row.date);
      byDay.set(key, row.count);
    }
  }

  const keys: string[] = [];
  const start = parseDateKey(fromDate);
  const end = parseDateKey(toDate);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    keys.push(toDateKey(d));
  }

  return keys.map((date) => ({
    date,
    count: byDay.get(date) ?? 0,
  }));
}
