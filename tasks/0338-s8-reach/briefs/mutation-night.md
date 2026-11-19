# Mutation night run: orchestrator brief (2026-11-17, after 00:00 local)

You orchestrate tonight's mutation runs for the Keel monorepo in the current git worktree (branch jdforsythe/test-impl; work only there). The operator allowed these runs after midnight on one condition: a timer bounds them, anything that takes too long or runs away is killed, and progress is checked so nothing gets stuck and pins the CPU. The machine is shared; a stuck or orphaned Stryker or vitest process pinning the CPU until morning is the failure you exist to prevent. Finishing fewer packages cleanly is a good result; a process left running is a bad one.

## Read first
- `docs/TESTING.md`, the paragraphs **Mutation**, **Wall-clock bounds** and **Mutation run time** (how `tooling/mutate.mjs` runs Stryker, the 30-minute budget per run, the incremental cache, `pnpm mutate:status`, `pnpm mutate:stop`).
- `node tooling/mutate.mjs --help 2>&1 | head -30` if it has one; else the header comment of `tooling/mutate.mjs`.

## What to run
One package at a time, never two at once, in this order: `schema`, `services`, `compiler`, `router`, `testing`, `check`, `server`, `cli`, and then, only if it is before 04:00, `store` and `runtime-dom`. The first eight hold the stale mutation claims as of 22:16 on 2026-11-16 (cli 22, server 14, router 6, testing 5, check 5, services 1, schema 1, compiler 1); the cache makes each run test only what changed, so the first four should be short. `server` changed most (the log scrub: `matcherOf.ts`, `scrubbed.ts`, `folded.ts`): a mutant there can loop, so expect timeouts, and apply the stuck rule without exception. Command per package: `pnpm --filter @keel/<pkg> mutate`.  A run ends by itself at its budget (30 minutes) and saves its cache; a package that did not finish all its mutants may be run again (the cache makes the next run continue), at most 3 runs per package. `cli` has never run with its sandbox under the root `.stryker-tmp`: if its dry run fails, capture the failing output (the last 60 lines), do not retry more than once, and move on.

Before each package:
- `git status --short -- packages/<pkg>` must be empty; if it is not, skip the package and say so.
- No other mutation run is live (`pnpm mutate:status`).
- List this worktree's processes: `ps -Ao pid,ppid,pcpu,etime,command -r | grep -F orca/workspaces/keel/test-impl | grep -v grep | head -30`. Anything that is a vitest worker, a Stryker process or a `node` test process and is not part of a run you started is a leftover: kill it (`kill`, then `kill -9` after 10 s) and record its pid, age and command.

## Timers (hard rules)
- Do not start before 00:00 local (`date`). If you are started early, wait in bounded steps.
- Per run: 30 minutes is the runner's own budget. Your hard cap is 40 minutes from the moment you started the run. At the cap: `pnpm mutate:stop` (it sends the one SIGINT and waits). Never signal Stryker by hand as the first step: a second signal loses the cache. If `pnpm mutate:stop` has not returned in 3 minutes, or a process of the run is still alive after it returns, then kill the run's process group and every leftover with `kill -9`, and record that the cache for that package may be lost.
- Progress: while a run is live, check `pnpm mutate:status` every 4 to 5 minutes and write each line with a timestamp to the log. If the mutant count has not moved across two checks in a row (about 10 minutes) after the dry run has ended, the run is stuck: stop it as above, record it, and do not run that package again tonight. A dry run that takes more than 12 minutes counts as stuck too.
- Whole night: start no new run after 05:00 local. At 05:45 local stop whatever is live as above. You must have reported back by 06:00.
- Your own waiting must be bounded: no single shell command of yours may run longer than 9 minutes, none may wait on stdin, none may be left running when you report. Start a run as a background command whose output goes to a log file, and wait with bounded polling commands (for example a loop that checks once a minute for at most 4 minutes whether the run's process is still alive, then returns).
- Run nothing else heavy: no `pnpm test`, no `pnpm check`, no `pnpm build`, no vitest of your own. `pnpm ledger` once at the end is the only other tool run.

## Log
Keep a plain log at `night.log` in a folder you create for this run outside the repository (`mkdir -p "$TMPDIR/keel-mutate"`; say its full path in your report) (append with `>>`): one line per event with `date '+%H:%M:%S'`: run started, each status check, run ended with its score line, each stop or kill with pids. Run output goes to `<pkg>-<n>.log` beside it. Create no file in the repository; do not commit, stage, stash or push. The ledger file `tooling/ledger/ledger.json` changing through `pnpm ledger` is expected; leave it uncommitted.

## At the end
1. `pnpm mutate:status` shows no live run; the process listing shows no Stryker or vitest process of this worktree. Kill what is left and say what it was.
2. `perl -e 'alarm 500; exec @ARGV' pnpm ledger 2>&1 | tail -15` once, on the quiet tree.
3. Report (plain text, under 350 words): for each package the runs made, start and end times, mutants done of total, the score and its threshold (80% for `schema`, `store` and `router`; 70% for the others), finished or stopped at budget or stuck or skipped; every stop and kill you made, with reason; the ledger's line after (items, verified, stale mutation claims); whether any process is left (it must not be); anything the main orchestrator has to do (a package under its threshold, a dry-run failure and its output).

## Tool added after this brief was written
`pnpm orphans` lists this worktree's processes whose parent is gone, mutation processes excluded (it prints `ok orphans 0 found` when clean); `pnpm orphans --kill` ends them. Use it between packages and at the end for vitest workers and dev servers. It never touches Stryker or `tooling/mutate.mjs`: for those, `pnpm mutate:status`, `pnpm mutate:stop`, and the `kill -9` rule above remain yours.
