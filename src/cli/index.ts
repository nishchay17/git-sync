#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import { yearBoundsUtc, defaultSyncRange } from "../utils/dateUtils.js";
import { loadConfig, optionalGithubToken } from "./config.js";
import { StateStore } from "../storage/stateStore.js";
import { runSync } from "../core/syncEngine.js";

const program = new Command();

program
  .name("gh-sync")
  .description("Mirror a GitHub contribution calendar into a personal repo using empty commits")
  .version("1.0.0");

function statePath(cwd: string): string {
  return resolve(cwd, "data", "state.json");
}

type RangeOpts = { from?: string; to?: string; year?: string };

function resolveRange(opts: RangeOpts): { from: string; to: string } {
  if (opts.year) {
    const y = parseInt(opts.year, 10);
    if (Number.isNaN(y) || y < 1970 || y > 2100) {
      throw new Error(`Invalid --year: ${opts.year}`);
    }
    return yearBoundsUtc(y);
  }
  if (opts.from && opts.to) {
    return { from: opts.from, to: opts.to };
  }
  if (opts.from || opts.to) {
    throw new Error("Use both --from and --to, or use --year, or omit for current UTC year.");
  }

  return defaultSyncRange();
}

program
  .command("sync")
  .description("Fetch source contributions and replay missing empty commits on the mirror repo")
  .option("-y, --year <year>", "Sync this calendar year (UTC)")
  .option("--from <date>", "Start date YYYY-MM-DD")
  .option("--to <date>", "End date YYYY-MM-DD (inclusive)")
  .option("--max-per-day <n>", "Override max commits per day", (v) => parseInt(v, 10))
  .option("--dry-run", "Show plan only; no git commits or push", false)
  .action(async (opts) => {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const token = optionalGithubToken();
    const { from, to } = resolveRange(opts);
    const maxPerDay =
      typeof opts.maxPerDay === "number" && !Number.isNaN(opts.maxPerDay)
        ? Math.max(1, opts.maxPerDay)
        : config.maxCommitsPerDay ?? 20;

    const store = new StateStore(statePath(cwd));
    const { commitsCreated } = await runSync({
      config,
      token,
      from,
      to,
      maxPerDay,
      dryRun: Boolean(opts.dryRun),
      stateStore: store,
      onLog: (line) => console.log(line),
    });
    console.log(`Done. Commits ${opts.dryRun ? "that would be created" : "created"}: ${commitsCreated}.`);
  });

program
  .command("backfill")
  .description("Sync a specific year (shortcut for sync --year)")
  .requiredOption("-y, --year <year>", "Calendar year (UTC)")
  .option("--max-per-day <n>", "Override max commits per day", (v) => parseInt(v, 10))
  .option("--dry-run", "No commits or push", false)
  .action(async (opts) => {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const token = optionalGithubToken();
    const { from, to } = yearBoundsUtc(parseInt(opts.year, 10));
    const maxPerDay =
      typeof opts.maxPerDay === "number" && !Number.isNaN(opts.maxPerDay)
        ? Math.max(1, opts.maxPerDay)
        : config.maxCommitsPerDay ?? 20;

    const store = new StateStore(statePath(cwd));
    const { commitsCreated } = await runSync({
      config,
      token,
      from,
      to,
      maxPerDay,
      dryRun: Boolean(opts.dryRun),
      stateStore: store,
      onLog: (line) => console.log(line),
    });
    console.log(`Backfill ${opts.year} complete. Commits: ${commitsCreated}.`);
  });

program
  .command("status")
  .description("Show config summary and last sync timestamp from state file")
  .action(async () => {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const store = new StateStore(statePath(cwd));
    const st = await store.read();
    console.log("Source (work) login:", config.sourceUsername);
    console.log("Mirror repo:", config.targetRepo);
    console.log("Local clone:", resolve(config.localRepoPath ?? ""));
    console.log("Max commits/day:", config.maxCommitsPerDay ?? 20);
    console.log("Last synced:", st.lastSyncedAt ?? "(never)");
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
