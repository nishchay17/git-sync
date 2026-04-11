import { simpleGit, type SimpleGit } from "simple-git";
import { spawnSync } from "node:child_process";
import { toDateKey } from "../utils/dateUtils.js";

export interface EmptyCommitOptions {
  message: string;
  authorDateIso: string;
  committerDateIso: string;
  name: string;
  email: string;
}

export class GitService {
  private git: SimpleGit;

  constructor(private readonly repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async addRemote(name: string, url: string): Promise<void> {
    const remotes = await this.git.getRemotes(true);
    const existing = remotes.find((r) => r.name === name);
    if (existing) {
      await this.git.removeRemote(name);
    }
    await this.git.addRemote(name, url);
  }

  async setRemoteUrl(name: string, url: string): Promise<void> {
    await this.git.remote(["set-url", name, url]);
  }

  async getLocalBranches(): Promise<string[]> {
    const summary = await this.git.branchLocal();
    return summary.all;
  }

  async remoteRefExists(ref: string): Promise<boolean> {
    try {
      await this.git.revparse([ref]);
      return true;
    } catch {
      return false;
    }
  }

  /** Checkout local `branch` tracking `origin/${branch}` after fetch. */
  async checkoutOrCreateTracking(branch: string): Promise<void> {
    const locals = await this.getLocalBranches();
    if (locals.includes(branch)) {
      await this.git.checkout(branch);
      try {
        await this.pullFf("origin", branch);
      } catch {
        /* non-fast-forward or no upstream */
      }
    } else {
      await this.git.checkout(["-b", branch, `origin/${branch}`]);
    }
  }

  async fetchRemote(remote = "origin"): Promise<void> {
    await this.git.fetch(remote);
  }

  async pullFf(remote = "origin", branch?: string): Promise<void> {
    const b = branch ?? (await this.git.branchLocal()).current;
    await this.git.pull(remote, b, ["--ff-only"]);
  }

  /**
   * Parses `git log` dates and returns how many commits fall on each UTC calendar day.
   */
  async getCommitCountsByDay(): Promise<Map<string, number>> {
    const args = ["log", "--format=%cI"];
    let out: string;
    try {
      out = await this.git.raw(args);
    } catch {
      return new Map();
    }

    const counts = new Map<string, number>();
    for (const line of out.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const key = toDateKey(t);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  async createEmptyCommit(opts: EmptyCommitOptions): Promise<void> {
    const env = {
      ...process.env,
      GIT_AUTHOR_DATE: opts.authorDateIso,
      GIT_COMMITTER_DATE: opts.committerDateIso,
    };

    const r = spawnSync(
      "git",
      [
        "-c",
        `user.name=${opts.name}`,
        "-c",
        `user.email=${opts.email}`,
        "commit",
        "--allow-empty",
        "-m",
        opts.message,
      ],
      { cwd: this.repoPath, env, encoding: "utf8" }
    );

    if (r.status !== 0) {
      const err = (r.stderr || r.stdout || "").toString().trim();
      throw new Error(err || `git commit failed with exit ${r.status}`);
    }
  }

  async push(remote = "origin", branch?: string): Promise<void> {
    const b = branch ?? (await this.git.branchLocal()).current;
    await this.git.push(remote, b);
  }

  get path(): string {
    return this.repoPath;
  }
}
