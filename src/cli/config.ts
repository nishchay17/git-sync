import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GhSyncConfig } from "../types/types.js";

const CONFIG_NAMES = [".gh-sync.json", "gh-sync.config.json"];

function envString(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Optional PAT for HTTPS clone/push to the mirror (`x-access-token` in remote URL).
 * Not required for fetching contributions (public HTTP API). Omit if you use SSH or another credential helper.
 */
export function optionalGithubToken(): string | undefined {
  return envString("GITHUB_TOKEN") ?? envString("GH_TOKEN");
}

export async function loadConfig(cwd: string): Promise<GhSyncConfig> {
  let fileConfig: Partial<GhSyncConfig> = {};

  for (const name of CONFIG_NAMES) {
    const p = resolve(cwd, name);
    try {
      const raw = await readFile(p, "utf8");
      fileConfig = JSON.parse(raw) as Partial<GhSyncConfig>;
      break;
    } catch {
      // try next name
    }
  }

  const sourceUsername =
    envString("GH_SYNC_SOURCE_USERNAME") ?? fileConfig.sourceUsername;
  const targetRepo = envString("GH_SYNC_TARGET_REPO") ?? fileConfig.targetRepo;

  if (!sourceUsername) {
    throw new Error(
      "Missing sourceUsername. Set GH_SYNC_SOURCE_USERNAME or add sourceUsername to .gh-sync.json (work GitHub login to mirror)."
    );
  }
  if (!targetRepo || !targetRepo.includes("/")) {
    throw new Error(
      'Missing targetRepo. Set GH_SYNC_TARGET_REPO or add targetRepo to .gh-sync.json (personal repo as "owner/name").'
    );
  }

  const localRepoPath =
    envString("GH_SYNC_LOCAL_PATH") ??
    fileConfig.localRepoPath ??
    resolve(cwd, "data", "mirror-repo");

  const maxRaw = envString("GH_SYNC_MAX_PER_DAY") ?? fileConfig.maxCommitsPerDay?.toString();
  const maxCommitsPerDay = maxRaw ? Math.max(1, parseInt(maxRaw, 10) || 20) : fileConfig.maxCommitsPerDay ?? 20;

  const gitName = envString("GIT_AUTHOR_NAME") ?? envString("GH_SYNC_GIT_NAME") ?? fileConfig.gitName;
  const gitEmail =
    envString("GIT_AUTHOR_EMAIL") ?? envString("GH_SYNC_GIT_EMAIL") ?? fileConfig.gitEmail;

  return {
    sourceUsername,
    targetRepo,
    localRepoPath,
    maxCommitsPerDay,
    gitName,
    gitEmail,
  };
}
