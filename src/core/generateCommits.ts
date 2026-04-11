import type { GitService } from "../git/gitService.js";
import { randomTimestampOnDay } from "../utils/dateUtils.js";
import type { GenerateCommitsOptions } from "../types/types.js";

export interface GenerateResult {
  commitsCreated: number;
}

/**
 * Creates `needed.get(date)` empty commits per day with randomized times in that day.
 */
export async function generateCommitsForDays(
  git: GitService,
  needed: ReadonlyMap<string, number>,
  options: GenerateCommitsOptions
): Promise<GenerateResult> {
  let commitsCreated = 0;

  const sortedDays = [...needed.keys()].sort();

  for (const date of sortedDays) {
    const n = needed.get(date) ?? 0;
    if (n <= 0) continue;

    for (let i = 0; i < n; i++) {
      const ts = randomTimestampOnDay(date);
      const message = `activity mirror ${date} #${i + 1}`;

      if (options.dryRun) {
        commitsCreated++;
        continue;
      }

      await git.createEmptyCommit({
        message,
        authorDateIso: ts,
        committerDateIso: ts,
        name: options.gitName,
        email: options.gitEmail,
      });
      commitsCreated++;
    }
  }

  return { commitsCreated };
}
