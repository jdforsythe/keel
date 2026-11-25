# The gate

`pnpm gate [<rev>]` runs, on this machine, what CI runs on a pull request, on one commit (default `HEAD`). It reads every job and step from `tooling/ci.source.json`, the same file `tooling/generate.mjs` turns into `.github/workflows/ci.yml`, so a command changed for CI is the command the gate runs. A green gate is the check before a push.

## Where it runs

The gate checks the commit out in `.worktrees/verify` of the main worktree: the outermost registered worktree that holds the one you run it from, so a lane in `.worktrees/<lane>` gates in its main line's checkout. That checkout must have no tracked changes; a lock file in its git dir stops a second gate. Each job instance starts from a fresh tree, as a runner does: `git reset --hard <sha>`, `git clean -ffdx` keeping `node_modules`, and no `.vite` or `.cache` folders. Then the job's steps run in order with `bash --noprofile --norc -eo pipefail`, each in its own process group.

The environment is CI's: `CI=true`, `GITHUB_ACTIONS=true`, the source's `env`, the job's `env`, `RUNNER_TEMP` under the run's log folder, and none of the variables that tell a tool an agent drives it (`CLAUDECODE` and the rest of `AGENT_VARS` in `tooling/gate-plan.mjs`). Vitest reads these: under `CI` it refuses `.only` and writes no new snapshot. When the commit has `tooling/test-time.ts`, `KEEL_TEST_TIME_SCALE` is set to `--scale` (default `0.1`), so each test bound is a tenth of its stated time and a test that would time out on CI's slower runner times out here. Node is the major `actions/setup-node` pins, the newest release of it under `~/.nvm` when the `node` on `PATH` is another major; pnpm is the root `packageManager` pin. A version that does not match fails the gate before any job.

Actions are not run. Checkout, pnpm, node and `actions/cache` are the steps above. `actions/cache/save` of `.turbo/cache` copies it aside after `check`, and `actions/cache/restore` puts it back in the jobs that restore it. `actions/upload-artifact` with `if-no-files-found: error` checks that its files exist. `actions/setup-java` sets `JAVA_HOME` to an installed JDK of that major. Any other action, any step `if` but `always()`, any `shell:`, or any `${{ }}` expression besides `matrix`, `secrets` and `vars` (empty here), `github.workspace`, `runner.os`, `runner.arch` and `needs.<job>.result` fails the gate: it is decided in `tooling/gate-plan.mjs` first.

## What runs

| Job | On this machine |
| --- | --- |
| `check` | runs |
| `test-shard` 1 to 6 | runs, one instance per shard |
| `test` | runs |
| `postgres` | runs with docker: the `postgres:17` service as `keel-gate-pg` and the ssl container as `keel-gate-pg-ssl`, each on a free port |
| `built-smokes`, `build`, `budgets` | runs |
| `golden-1-images` | runs with docker, when its credential helper answers within 10 seconds (a locked one hangs every pull) |
| `changes` | skipped: it only decides whether the shell jobs run on a pull request |
| `shell-tauri` | skipped: Ubuntu only (WebKitGTK, WebKitWebDriver, Xvfb) |
| `shell-android` | `--with shell-android`: a Gradle build of the APK |
| `shell-tauri-macos` | `--with shell-tauri-macos`: a Rust build of the Tauri shell |
| `shell-ios` | `--with shell-ios`: `xcodebuild` and an iOS Simulator |
| `mutate-pr` | `--with mutate-pr`; `pnpm mutate:changed` is the same run |
| `eval` | `--with eval`; CI runs it weekly |

Jobs run one at a time, each after its `needs`. A job whose tool is missing (docker not running, a credential helper that does not answer, no Android SDK, no Xcode, no rustup) is reported `not-run` and fails the gate unless `--allow-skip <job>`. A job in the source that the table in `tooling/gate-plan.mjs` does not name fails the gate with E0013, so a new CI job is decided there. The postgres job's ports and container names are rewritten for this machine (port 5432 is taken here); each rewrite must match the source, so a changed command fails the gate instead of running unrewritten.

A step fails on a non-zero exit, on the job's `timeout-minutes`, or when its output has a line starting `fail ` (the tooling trailer of `docs/OUTPUT.md`). Before each `run` step the gate waits while the one-minute load is above `--max-load` (default 30), for at most `--load-wait` minutes (default 20), and records the load it started at. After a failed step the job's later steps do not run, except those with `if: always()`.

A job runs even when a job it needs failed, so one gate reports every failure; CI skips such a job. The `test` job reads `needs.test-shard.result`, so it fails when a shard failed or did not run, `--only test` included.

## Flags

- `<rev>`: the commit to gate; default `HEAD`.
- `--only <job,...>`: run only these jobs. The result is partial, and the last line says so.
- `--with <job,...>`: also run these flag jobs.
- `--allow-skip <job,...>`: a `not-run` job of these does not fail the gate.
- `--fail-fast`: after a failed job, the rest are `not-run`.
- `--scale <n>`: `KEEL_TEST_TIME_SCALE`; default `0.1`.
- `--max-load <n>`, `--load-wait <minutes>`: the wait before each step.
- `--worktree <path>`: another registered clean checkout.
- `--linux`: `check` and `test-shard` in a `node:<major>` container (2 CPUs, 7 GB), from a clone of the repository's git dir mounted read-only. The result is marked partial.
- `--status [<rev>]`: `ok gate-status` when the commit has a full green gate; `fail gate-status` when it has none, a failed one or a partial one.

## Output

One line per job: `ok check 912.4s, load 21.3`, `skip eval: runs only on the weekly schedule (--with eval)`, or `fail test-shard 2 ...` with the step, its exit, up to five `fail ` lines and its log. The last line is `ok gate <sha> 9 jobs, 7 skipped, scale 0.1, node v22.23.1 (nvm), pnpm 11.17.0 (10920.4s)` or `fail gate <sha> ... first: <job>/<step>`. Each step's log is under `$TMPDIR/keel-gate-<sha>/<job>/`. The record of the run, every job and step with its time and load, is `.keel-gate/<sha>.json` in the main worktree.

## Equal to CI

The commands come from `tooling/ci.source.json` and nowhere else. What the gate cannot read from the source is in `tooling/gate-plan.mjs`: the job table, the actions it knows, the expressions it answers and the postgres rewrites, and the tests in `tooling/test/gate-plan.test.ts` run every one of them against the real source. A change to the source that the gate has not decided (a job, an action, an expression, a step condition, a rewrite that no longer matches) fails the gate before it runs. Two differences remain: this machine is macOS on arm64 where CI is Ubuntu on x64 (`--linux` covers the operating system, not the architecture), and its cores are faster, which the time scale answers.

subject: tooling/gate.mjs tooling/gate-plan.mjs tooling/ci.source.json
verified: b80c8a0b0d4d29429b3aac010d824b2c7981759c
