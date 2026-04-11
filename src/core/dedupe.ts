import type { DailyContribution } from "../types/types.js";

/**
 * For each day, how many empty commits still need to be created
 * given API counts and what's already in the mirror repo.
 */
export function commitsNeededByDay(
  contributions: DailyContribution[],
  existingCounts: ReadonlyMap<string, number>,
  maxPerDay: number
): Map<string, number> {
  const needed = new Map<string, number>();

  for (const { date, count } of contributions) {
    if (count <= 0) continue;
    const target = Math.min(count, maxPerDay);
    const have = existingCounts.get(date) ?? 0;
    const n = Math.max(0, target - have);
    if (n > 0) needed.set(date, n);
  }

  return needed;
}
