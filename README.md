# GitHub activity sync (`gh-sync`)

CLI tool that reads a **source** GitHub user’s public contribution calendar (for example your work account) and replays that activity on a **personal** repository using **empty commits** only—no source code is copied.

## Requirements

- Node.js 18+
- Git installed and on `PATH`
- Mirror repo on your personal account (create an empty repo or one with a README; default branch `main` or `master`)

**Fetching contributions** uses the public HTTP API  
`https://github-contributions-api.jogruber.de/v4/{username}?y={year}`  
(no GitHub API token).

**Pushing** to GitHub still needs normal git authentication: SSH remote, credential manager, or optionally `GITHUB_TOKEN` / `GH_TOKEN` (PAT with `repo`) so the tool can embed a token in the HTTPS remote.

## GitHub contribution rules

- Commit **author email** must be associated with your **personal** GitHub account (use the address from [Email settings](https://github.com/settings/emails), often `id+username@users.noreply.github.com`).
- The mirror repo should be **public**, or you must allow private contributions in your profile settings.
- Commits must land on the **default branch** you track locally after clone (the tool checks out `origin/main` or `origin/master`).

## Configuration

1. Copy `.gh-sync.json.example` to `.gh-sync.json` in the project directory (or set the same fields with environment variables).

| Field / variable | Meaning |
|------------------|--------|
| `sourceUsername` / `GH_SYNC_SOURCE_USERNAME` | Login whose contribution graph you mirror (work account). |
| `targetRepo` / `GH_SYNC_TARGET_REPO` | Personal mirror as `owner/repo`. |
| `localRepoPath` / `GH_SYNC_LOCAL_PATH` | Where the tool clones the mirror; default `data/mirror-repo`. |
| `maxCommitsPerDay` / `GH_SYNC_MAX_PER_DAY` | Cap commits per calendar day (GitHub’s graph also saturates visually). |
| `gitName`, `gitEmail` / `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL` | Commit identity for the mirror (personal account). |

2. **Optional** — for HTTPS without interactive login:

```bash
export GITHUB_TOKEN=ghp_xxxx   # or fine-grained PAT with repo scope
```

On Windows (PowerShell): `$env:GITHUB_TOKEN="ghp_xxxx"`.

## Usage

```bash
npm install
npm run build
```

```bash
# Current UTC calendar year
node dist/cli/index.js sync

# Specific year
node dist/cli/index.js sync --year 2024
node dist/cli/index.js backfill --year 2024

# Custom range (inclusive; may call the API once per year in range)
node dist/cli/index.js sync --from 2023-01-01 --to 2024-03-15

# Plan only
node dist/cli/index.js sync --dry-run

# Cap intensity
node dist/cli/index.js sync --max-per-day 10

# Config summary
node dist/cli/index.js status
```

Global install (optional): `npm link` from this repo, then run `gh-sync sync`.

## How it works

1. **Fetch** — One request per calendar year in range: `GET .../v4/{username}?y={year}` → `{ contributions: [{ date, count, level }, ...] }`.
2. **Dedupe** — `git log` on the mirror → counts per UTC day; only missing commits are created.
3. **Commit** — For each needed commit, `git commit --allow-empty` with `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` randomized within that day.
4. **Push** — Pushes to `origin` (HTTPS with optional embedded token, or your configured credentials).

## Automation (cron in this repo)

Workflow [`.github/workflows/sync-activity.yml`](.github/workflows/sync-activity.yml) runs on a schedule (and manually). It checks out **this** repository with **full history** (`fetch-depth: 0` so dedupe matches existing commits), runs `npm ci` / `npm run build`, then `node dist/cli/index.js sync` with:

| Env | Value |
|-----|--------|
| `GH_SYNC_LOCAL_PATH` | `${{ github.workspace }}` — the checked-out repo (no separate clone) |
| `GH_SYNC_TARGET_REPO` | `${{ github.repository }}` — same repo |
| `GITHUB_TOKEN` | Default Actions token (push to this repo) |
| `GH_SYNC_SOURCE_USERNAME` | **Repository variable** — login to mirror |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` | **Repository variables** — should match your GitHub profile email so contributions count |

The job is skipped until **`GH_SYNC_SOURCE_USERNAME`** is set (empty variable = no-op), so forks stay quiet until configured.

## Legal and policy

Use this only where your employer and GitHub’s terms allow mirroring **metadata** (counts/dates), not proprietary code. This tool does not access repository contents on the source account. Third-party contribution APIs may differ slightly from GitHub’s own graph.

## License

MIT
