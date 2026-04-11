import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { simpleGit } from "simple-git";
import type { GhSyncConfig } from "../types/types.js";
import { commitsNeededByDay } from "./dedupe.js";
import { fetchContributions } from "./fetchContributions.js";
import { generateCommitsForDays } from "./generateCommits.js";
import { GitService } from "../git/gitService.js";
import { StateStore } from "../storage/stateStore.js";
import { httpsRemotePublic, httpsRemoteWithAuth } from "../utils/remote.js";

export interface RunSyncParams {
  config: GhSyncConfig;
  /** If set, used for HTTPS remote with embedded token; otherwise public HTTPS URL (SSH/credential helper for auth). */
  token?: string | undefined;
  from: string;
  to: string;
  maxPerDay: number;
  dryRun: boolean;
  stateStore: StateStore;
  onLog?: (line: string) => void;
}

function logLine(onLog: RunSyncParams["onLog"], msg: string) {
  onLog?.(msg);
}

export async function resolveGitIdentity(
  config: GhSyncConfig,
  repoPath?: string
): Promise<{ name: string; email: string }> {
  if (config.gitName && config.gitEmail) {
    return { name: config.gitName, email: config.gitEmail };
  }

  const git = simpleGit(repoPath ?? process.cwd());
  const name =
    config.gitName ?? (await git.getConfig("user.name", "global"))?.value ?? "";
  const email =
    config.gitEmail ?? (await git.getConfig("user.email", "global"))?.value ?? "";

  if (!name || !email) {
    throw new Error(
      "Set gitName and gitEmail in .gh-sync.json (or GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL) so commits match your personal GitHub account."
    );
  }

  return { name, email };
}

/**
 * Clone or open mirror repo; bootstrap empty remotes with an initial empty commit.
 */
export async function ensureMirrorRepo(
  localPath: string,
  targetRepo: string,
  token: string | undefined,
  identity: { name: string; email: string },
  onLog?: (line: string) => void
): Promise<GitService> {
  await mkdir(localPath, { recursive: true });
  const originUrl = token
    ? httpsRemoteWithAuth(targetRepo, token)
    : httpsRemotePublic(targetRepo);

  if (!existsSync(`${localPath}/.git`)) {
    logLine(onLog, `Cloning ${targetRepo} into ${localPath} …`);
    try {
      await simpleGit().clone(originUrl, localPath, ["--origin", "origin"]);
    } catch {
      logLine(
        onLog,
        "Clone failed (often an empty new repo). Initializing, empty commit, push …"
      );
      const g = simpleGit(localPath);
      await g.init(["-b", "main"]);
      const gs = new GitService(localPath);
      await gs.addRemote("origin", originUrl);
      const ts = new Date().toISOString();
      await gs.createEmptyCommit({
        message: "chore: init activity mirror",
        authorDateIso: ts,
        committerDateIso: ts,
        name: identity.name,
        email: identity.email,
      });
      await gs.push("origin", "main");
    }
  }

  const gitSvc = new GitService(localPath);
  try {
    await gitSvc.setRemoteUrl("origin", originUrl);
  } catch {
    await gitSvc.addRemote("origin", originUrl);
  }

  try {
    await gitSvc.fetchRemote("origin");
  } catch (e) {
    logLine(onLog, `Fetch note: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (await gitSvc.remoteRefExists("origin/main")) {
    await gitSvc.checkoutOrCreateTracking("main");
  } else if (await gitSvc.remoteRefExists("origin/master")) {
    await gitSvc.checkoutOrCreateTracking("master");
  }

  return gitSvc;
}

export async function runSync(params: RunSyncParams): Promise<{ commitsCreated: number }> {
  const { config, token, from, to, maxPerDay, dryRun, stateStore, onLog } = params;

  const identity = await resolveGitIdentity(config);

  logLine(onLog, `Fetching contributions for ${config.sourceUsername} (${from} … ${to}) …`);
  const contributions = await fetchContributions(config.sourceUsername, from, to);
  const activeDays = contributions.filter((c) => c.count > 0).length;
  logLine(onLog, `API: ${activeDays} days with activity in range.`);

  const gitSvc = await ensureMirrorRepo(
    config.localRepoPath!,
    config.targetRepo,
    token,
    identity,
    onLog
  );

  const existing = await gitSvc.getCommitCountsByDay();
  const needed = commitsNeededByDay(contributions, existing, maxPerDay);

  let totalNeeded = 0;
  needed.forEach((n) => {
    totalNeeded += n;
  });
  logLine(onLog, `Commits to create: ${totalNeeded}${dryRun ? " (dry-run)" : ""}.`);

  const { commitsCreated } = await generateCommitsForDays(gitSvc, needed, {
    dryRun,
    gitName: identity.name,
    gitEmail: identity.email,
  });

  if (!dryRun && commitsCreated > 0) {
    logLine(onLog, "Pushing to origin …");
    await gitSvc.push("origin");
    await stateStore.touchLastSynced();
  } else if (dryRun) {
    logLine(onLog, "Dry-run: no push.");
  } else {
    logLine(onLog, "Nothing to push.");
  }

  return { commitsCreated };
}
