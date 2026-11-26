# The gate

`pnpm gate [<rev>]` runs, on this machine, what CI runs on a pull request, on one commit (default `HEAD`). It reads every job and step from `tooling/ci.source.json`, the same file `tooling/generate.mjs` turns into `.github/workflows/ci.yml`, so a command changed for CI is the command the gate runs. A green gate is the check before a push.

## Where it runs

The gate checks the commit out in `.worktrees/verify` of the main worktree: the outermost registered worktree that holds the one you run it from, so a lane in `.worktrees/<lane>` gates in its main line's checkout. That checkout must have no tracked changes; a lock file in its git dir stops a second gate. Each job instance starts from a fresh tree, as a runner does: `git reset --hard <sha>`, `git clean -ffdx` keeping `node_modules`, and no `.vite` or `.cache` folders. Then the job's steps run in order with `bash --noprofile --norc -eo pipefail`, each in its own process group.

The environment is CI's: `CI=true`, `GITHUB_ACTIONS=true`, the source's `env`, the job's `env`, `RUNNER_TEMP` under the run's log folder, and none of the variables that tell a tool an agent drives it (`CLAUDECODE` and the rest of `AGENT_VARS` in `tooling/gate-plan.mjs`). Vitest reads these: under `CI` it refuses `.only` and writes no new snapshot. When the commit has `tooling/test-time.ts`, `KEEL_TEST_TIME_SCALE` is set to `--scale` (default `0.1`), so each test bound is a tenth of its stated time and a test that would time out on CI's slower runner times out here. Node is the major `actions/setup-node` pins, the newest release of it under `~/.nvm` when the `node` on `PATH` is another major; pnpm is the root `packageManager` pin. A version that does not match fails the gate before any job.

Actions are not run. Checkout, pnpm, node and `actions/cache` are the steps above. `actions/cache/save` of `.turbo/cache` copies it aside after `check`, and `actions/cache/restore` puts it back in the jobs that restore it. `actions/upload-artifact` with `if-no-files-found: error` checks that its files exist, and keeps those of an artifact a later job downloads (the `test-reports-<n>` of the shards and the `postgres` job's `test-reports-postgres`) in the run's log folder. `actions/download-artifact` copies the kept artifacts whose name matches its `pattern` into its `path`, one folder each, as a runner does, so the `ledger` job unpacks and reads the run reports its own shards wrote, after its own fresh tree. `actions/setup-java` sets `JAVA_HOME` to an installed JDK of that major. Any other action, any step `if` but `always()`, any `shell:`, or any `${{ }}` expression besides `matrix`, `secrets` and `vars` (empty here), `github.workspace`, `runner.os`, `runner.arch` and `needs.<job>.result` fails the gate: it is decided in `tooling/gate-plan.mjs` first.

## What runs

| Job | On this machine |
| --- | --- |
| `check` | runs |
| `test-shard` 1 to 6 | runs, one instance per shard |
| `test` | runs |
| `postgres` | runs with docker: the `postgres:17` service as `keel-gate-pg` and the ssl container as `keel-gate-pg-ssl`, each on a free port |
| `built-smokes`, `build`, `budgets` | runs |
| `golden-1-images` | runs with docker, when its credential helper answers within 10 seconds (a locked one hangs every pull) |
| `slow-shards` | runs with docker, after every other job: the six test shards in a Linux `node:22` container limited to 2 CPUs and 7,700 MB, at time scale 1 (see Slow machine) |
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

## Slow machine

The fast jobs run on cores several times faster than a hosted runner's, and the time scale only shrinks the bounds a test states. A bound a test does not state (vitest's flat 5 s default in a folder with its own config), a bound a slow core misses by milliseconds, and a real timer a fast machine never waits out are found only on a slow machine. `slow-shards` is that machine: it runs after every other job, so a cheap failure shows first, and it is not a job of `tooling/ci.source.json`; its commands are.

It clones the gated commit into the gate's own temp folder (`git clone --no-local`), starts one container `keel-gate-slow-<sha>` from `node:<the source's node major>` with `--cpus 2 --memory 7700m` (the hosted runner's 2 cores and 7.7 GB), an init (`--init`, so a killed process is reaped as on a runner) and the image's non-root user `node` (a runner is no root user, so a file mode stops a write), and `docker cp`s the tree in. Nothing under the checkouts or the home folder is mounted; the one volume is `keel-gate-pnpm-store`, pnpm's store, so a second run installs from the store. As root it enables corepack's shims (`/usr/local/bin` is root's) and installs `lsof` (`ubuntu-latest` has it, the image has not; the tests read listening ports with it) and gives the tree and the store to `node`. Inside, with `CI=true`, `GITHUB_ACTIONS=true`, the source's `env`, the job's `env` and `KEEL_TEST_TIME_SCALE=1`: `pnpm install --frozen-lockfile` and `pnpm build` once (the builds the `check` job leaves in CI's turbo cache, not timed as a shard). The prepared container is committed to an image, and each shard's `run` steps from the `test-shard` job, `node tooling/ci-shards.mjs <n>` first, run in a container of its own from that image (`keel-gate-slow-<sha>-<n>`, the same cpus and memory), up to three at once and no more than the docker machine's cpus and memory hold; one record per shard (`slow-shards 3`), its time in the job line. A shard that fails does not stop the others; a step past the job's `timeout-minutes` ends that shard. Every docker command has a time limit (120 s for create and removal, 10 min for a pull or the setup, 15 min for the copy and the commit); one that hangs fails the job and names the command. The containers and the image are removed at the end, after a failure and on SIGINT or SIGTERM, and the check for what is left covers them. Without docker the job is `not-run` and fails the gate like the other docker jobs.

`--skip-slow` skips it. The gate's last line then ends `, slow-shards skipped (--skip-slow)`, `.keel-gate/<sha>.json` has `"slowSkipped": true`, and `--status` answers `fail gate-status ... not a whole pass` for that commit, as it does for a commit whose gate had no passing `slow-shards`. `--slow-cpus <n>` and `--slow-memory <size>` set the limits (`--slow-cpus 1` is harsher than the runner); `--slow-parallel <n>` sets how many shards run at once (`1` runs them one after another in the prepared container). A failing shard is a finding: its case is fixed at the cause, not given a larger bound.

## Flags

- `<rev>`: the commit to gate; default `HEAD`.
- `--only <job,...>`: run only these jobs (`slow-shards` is a name it takes). The result is partial, and the last line says so.
- `--with <job,...>`: also run these flag jobs.
- `--allow-skip <job,...>`: a `not-run` job of these does not fail the gate.
- `--fail-fast`: after a failed job, the rest are `not-run`.
- `--skip-slow`: skip `slow-shards`; the result records it.
- `--slow-cpus <n>`, `--slow-memory <size>`: each container's CPUs (default 2) and memory (default `7700m`).
- `--slow-parallel <n>`: shards at once (default 3, fewer when the docker machine cannot hold them).
- `--scale <n>`: `KEEL_TEST_TIME_SCALE`; default `0.1`.
- `--max-load <n>`, `--load-wait <minutes>`: the wait before each step.
- `--worktree <path>`: another registered clean checkout.
- `--quiet`: the last line only.
- `--status [<rev>]`: `ok gate-status` when the commit has a full green gate; `fail gate-status` when it has none, a failed one or a partial one.

Any other flag fails with exit 2.

## Output

One line per job: `ok check 912.4s, load 21.3`, `skip eval: runs only on the weekly schedule (--with eval)`, or `fail test-shard 2 ...` with the step, its exit, up to five `fail ` lines and its log. The last line is `ok gate <sha> 13 jobs, 7 skipped, scale 0.1, node v22.23.1 (nvm), pnpm 11.17.0 (10920.4s)` or `fail gate <sha> ... first: <job>/<step>`. Each step's log is under `$TMPDIR/keel-gate-<sha>/<job>/`. The record of the run, every job and step with its time and load, is `.keel-gate/<sha>.json` in the main worktree. On SIGINT or SIGTERM the gate stops its process groups and containers, checks that none is left, writes the record and fails. The images `golden-1-images` builds stay, tagged `golden-1-<deployable>`, for `docker rmi` to remove.

## Equal to CI

The commands come from `tooling/ci.source.json` and nowhere else. What the gate cannot read from the source is in `tooling/gate-plan.mjs`: the job table, the actions it knows, the expressions it answers and the postgres rewrites. `tooling/test/gate-plan.test.ts` checks the table and the rewrites against the real source in `pnpm test`. A change to the source that the gate has not decided (a job, an action, an expression, a step condition, a rewrite that no longer matches) fails the gate before it runs. Two differences remain in the fast jobs, which `slow-shards` covers. This machine is macOS on arm64 where CI is Ubuntu on x64; the container is Linux, on this machine's architecture. Its cores are faster, which the time scale answers for the bounds a test states; vitest's flat 5 s default, which a folder outside `keelConfig` gets, does not scale, so structure-lint S0017 refuses a property case left to it, and a slow core finds the rest. The turbo wrapper asks for prefixed task logs (`--log-prefix=task`) because turbo groups them unprefixed under GitHub Actions, as here and in CI, so a failed task's own diagnostics show in both.

subject: tooling/gate.mjs tooling/gate-plan.mjs tooling/ci.source.json
verified: 78b224a7724305c9f7a6c285c9cb6343f31d22bb
