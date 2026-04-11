export interface DailyContribution {
  date: string;
  count: number;
}

export interface GhSyncConfig {
  /** GitHub login whose contribution calendar to mirror (e.g. work account). */
  sourceUsername: string;
  /** Target repository `owner/name` where empty commits are pushed (personal mirror repo). */
  targetRepo: string;
  /** Local clone path; default `./data/mirror-repo`. */
  localRepoPath?: string;
  /** Cap commits per calendar day; default 20. */
  maxCommitsPerDay?: number;
  /** Author/committer name for empty commits. */
  gitName?: string;
  /** Must match the email on your personal GitHub for contributions to count. */
  gitEmail?: string;
}

export interface SyncState {
  lastSyncedAt?: string;
}

export interface GenerateCommitsOptions {
  dryRun: boolean;
  gitName: string;
  gitEmail: string;
}
