# Shell replay in the Tauri shell (backlog 0817, the last piece of the S8 exit)

## What the design asks

RFC 0085:
- D3: "CI as Proposal 9 lists: Linux jobs per PR touching golden-1 (Tauri build and replay, Android debug APK) with a `postgres:17` service container pinned by digest; the Android emulator replay nightly once green on a developer machine; the iOS job on `macos-15` on manual dispatch only."
- Exit criterion (Proposal 9): "**golden-1 on std-db survives SIGKILL with byte-equal stored state on SQLite and on Postgres, a list removal resumes after a SIGKILL inside a step and ends once, golden-1's `web` ships from CI as a Tauri Linux binary and an Android debug APK, a recorded session replayed inside the Tauri shell gives the server state its sim replay gives, and the board's map-based transactions are `proven`.**"
- Proposal 9, Tauri row of "What runs where": "Tauri: `keel build --target tauri` (apt packages, `tauri-driver` pinned and cached), `tooling/smoke/shell.mjs --shell tauri` under `xvfb-run`: applies user 0's `fire` and `nav` inputs from the S4 group session to the shell over WebDriver by element id, then compares the server's `api.board` with `replayGroup`'s (ids normalized by first appearance); stops the API, toggles `t2` (outbox queues it), quits the app, starts the API and the app, and sees the write drain from the persisted outbox | every PR touching `apps/golden-1`, artifact uploaded | Linux; macOS and Windows build only (no WebDriver for WKWebView)".
- Proposal 9, "What the eval asserts", Shells: "both artifacts exist and are uploaded; the Tauri replay's normalized server board equals the sim replay's; the drained write is on the server after the app restart."
- Proposal 9, platform facts: "`tauri-driver` supports Linux and Windows, not macOS."

The clause this task closes: "a recorded session replayed inside the Tauri shell gives the server state its sim replay gives".

## What existed

- `tooling/ci-shell.mjs` and the `shell-tauri` job: builds the debug binary, starts the built `api` (port 4181, throwaway SQLite), a recording proxy at `KEEL_ORIGIN` (4182) and the binary under Xvfb, and passes when the app's native HTTP client reads `GET /api/lists` (E0014 otherwise). No WebDriver, no session, no comparison.
- The S4 group session: not a file. `evals/tasks/golden-1-api/acceptance.test.ts` generates it at run time (`race()`: `openGroup` with two users, seed 11, origin `http://golden-1.test`, the stored board Home with Milk and Bread at head 2) and replays it with `replayGroup`; the function is private to that hidden test (evals are not edited here). Nothing under `apps/golden-1` or `packages/testing` records a group.
- `replayGroup` (std.multi, `@keel/std-sessions/group`): restores `group.server`, opens every user at its base in its own worker, applies all inputs in order of `at`, user, index, and returns `{ users, server, reproduced }`, `server` holding each server store's snapshot with its log (`api.board`: `state`, `log`, `initial`, `head`, `keys`).
- `tooling/smoke/built.mjs`: the built-api helpers (`freePort`, `row` reading `keel_kv` with `node:sqlite`, `BOARD_KEY`).
- No WebDriver client in the repo's dependencies; `tauri-driver` not installed anywhere.

## Design

**The session.** `apps/golden-1/test/shellSession.ts` (`shellSession()`) records, under simulation, a one-user group: `openGroup({ users: 1, seed: 11, origin: 'http://golden-1.test', server: { 'api.board': <Home, Milk, Bread, head 2> } })`, then user 0's inputs of the S4 race script, each followed by `settle` and 1 ms: open Home, mark Milk done, open Milk's edit page, type Oat milk, save, type Eggs, add. It stops the group, replays it with `replayGroup`, and returns the group, the starting board, the live server board, `replayGroup`'s server board and `reproduced`. Generated at run time from the seed (about 4 s), so no session file is committed.

Why a one-user group and not the two-user race group: the race group's server end state holds user 1's offline toggle (entry 6) and its conflict choice, so applying only user 0's inputs in one shell could never equal `replayGroup` of that group; and the race needs user 1 offline mid-session, which no page input in the shell can do. The RFC's words "user 0's `fire` and `nav` inputs from the S4 group session" are met as user 0's inputs re-recorded as their own group, from the same starting board and seed.

**The mapping** (`tooling/smoke/shellReplay.mjs`, `actionsOf`). The smoke writes the group to `.keel/sessions/golden-1-shell.group.json` in its temp folder and reads user 0's events back from that file. Each input becomes a page action: `nav` follows the link whose `href` is the target (`a[href="..."]`, a click) unless the route is already there; `fire click` and `fire change` are an element click; `fire input` clears the field and types the value; `fire keydown` presses the key. A `submit` or `nav` recorded at the same `at` as the `fire` before it is that click's effect (the form's submit, the action's route) and is left out, as `replay` passes over it. `net`, `focus`, `blur`, a `submit` of its own and unknown keys are `unsupported` and fail E0014 before the shell starts. The recorded inputs, 10, become 7 actions.

**The comparison** (`normalized`, `boardDiff`). Each log entry's `at` is dropped (sim clock against wall clock), and every UUID (the minted todo id, write keys) and every `caller` is numbered by first appearance (`id#1`, `caller#1`), in the order state, log, the rest; object keys sorted. Differences print as `E0015 api.board <path>: shell <a> sim <b>`, five per code then `... +n more E0015`.

**The run** (`tooling/smoke/shell.mjs --shell tauri [--binary <path>]`). 1. The session, in a child `node --import tsx` (the group's workers load TypeScript; `NODE_ENV=test` because `createApp` without `assets` refuses production), at most 180 s; it must have `reproduced` and the live board equal the replayed one, else E0015. 2. A fresh SQLite file holding the group's starting board in `keel_kv`, the built `api` on a free port over it, and the recording proxy at `KEEL_ORIGIN` (it counts requests in flight; an event stream is not one). 3. `tauri-driver` on free ports, each child in its own process group; a WebDriver session with `tauri:options.application` = the binary; the app must read `GET /api/lists` through `tauri-plugin-http` within 90 s (the old load check, folded in). Each action waits up to 15 s for its element (`[id="..."]`) and then for the proxy to be quiet for 600 ms (at most 20 s). 4. The stored `api.board` row once it has held still 1.5 s (at most 15 s), against `replayGroup`'s. The binary, the driver (its process group: WebKitWebDriver and the app), the proxy and the api are stopped in `finally` and on SIGINT/SIGTERM; the temp folder is removed. `tooling/ci-shell.mjs` is removed: its start, proxy and stop code moved into the smoke and its load check is the smoke's step 3.

**The WebDriver client** (`tooling/smoke/webdriver.mjs`): the W3C commands used (new session, url, element, click, clear, value, execute, delete session) over `fetch`, each with a time limit. No dependency added.

**Real input or script.** Real input. WebKitWebDriver performs Element Click and Element Send Keys as synthesized mouse and keyboard events in the browser process, so the page sees trusted events. Measured in the container (a capture listener installed through Execute Script, reading `isTrusted`): every `click`, `keydown`, `input`, `change` from typing, and `submit` was `true`; the one `false` was the `change` that Element Clear dispatches when it empties a field (the WebDriver clear algorithm fires it from script). Typing gives one `keydown` and `input` per character where the session holds one `input` with the whole value; the field's final value is the same. Script evaluation was used only for that probe, never to drive the app.

## CI

`shell-tauri` in `tooling/ci.source.json` (ci.yml regenerated):
- the apt step adds `webkit2gtk-driver` (WebKitWebDriver);
- `tauri-driver, pinned`: `actions/cache@v4` on `~/.cargo/bin/tauri-driver`, key `tauri-driver-2.1.0-<os>-<arch>`; then, on a cache miss, `cargo install tauri-driver --version 2.1.0 --locked`;
- after the build, one step replaces the load check: `xvfb-run -a node --disable-warning=ExperimentalWarning tooling/smoke/shell.mjs --shell tauri --binary .cargo-target/debug/golden-1`.

Expected minutes: cold adds the `tauri-driver` compile (10 s on 2 arm64 cores with the registry already fetched by the build; expect 1-2 min on the runner) and the smoke (about 15 s here; expect under 1 min), so about 8-12 min cold; warm about 3.5-4.5 min. The job's 30-minute limit stands.

## Docker proof

Container `keel-shell-replay`, `ubuntu:24.04` arm64 (this machine is Apple silicon), `docker run -d --init --cpus 2 --memory 7700m`, the repo mounted read-only at `/src` and copied to `/work` with `tar` (no `node_modules`, `dist`, `.git`, Cargo target). A first container took the same steps while the smoke was written; the record below is a second, fresh container running the finished files end to end. Total 205 s of machine time.

| Step | Command | Result | Time |
| --- | --- | --- | --- |
| apt | `apt-get install --no-install-recommends libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev xvfb xauth webkit2gtk-driver ca-certificates xz-utils` | `webkit2gtk-4.1` 2.52.6; `/usr/bin/WebKitWebDriver` | 38 s |
| Node | nodejs.org `v22.23.5` linux-arm64 tarball | `v22.23.5` | 1 s |
| Rust | `rustup` stable, minimal | `cargo 1.100.0` | 9 s |
| copy | `tar -C /src ... \| tar -C /work -x` | 39 MB | 0 s |
| install | `corepack enable && pnpm install --frozen-lockfile` | `Done in 8.3s` | 10 s |
| build | `KEEL_ORIGIN=http://localhost:4182 CARGO_TARGET_DIR=/work/.cargo-target pnpm exec keel build --target tauri` in `apps/golden-1` | `ok build web tauri dist/web/tauri/target/debug/golden-1`; binary 223,762,896 bytes; `dist/api/server.mjs` | 63 s |
| driver | `cargo install tauri-driver --locked` | `tauri-driver v2.1.0` | 11 s |
| replay | `xvfb-run -a node --disable-warning=ExperimentalWarning tooling/smoke/shell.mjs --shell tauri --binary .cargo-target/debug/golden-1` | `ok shell 7 actions, 5 head (12.2s)`, exit 0 | 12 s |
| leftovers | `ps -eo pid,stat,comm,args \| grep -E 'golden-1\|tauri-driver\|WebKitWebDriver\|server.mjs\|Xvfb'` two seconds later | none | |

Probes on the same build (container-only copies of the smoke, restored after each):
- Boards and input trust: the smoke with a capture listener installed through Execute Script and both normalized boards written out: `ok shell 7 actions, 5 head (10.5s)`; the boards are equal. Shell state: Home; Milk renamed Oat milk, done; Bread; Eggs (`id#1`). Log: `#3 api.toggleTodo {id: t1}`, `#4 api.editTodo {id: t1, title: Oat milk, priority: normal}`, `#5 api.addTodo {id: id#1, listId: l1, title: Eggs}`, each one caller, head 5; `replayGroup`'s is the same. Events seen by the page: every `click`, `keydown`, `input`, typed `change` and `submit` `isTrusted: true`; one `change:todos.editForm:title:false`, from Element Clear.
- Planted twin (the mapping drops the last action, the click on Add): `E0015 api.board head: shell 4 sim 5`, `keys.2: shell (none) sim {"key":"id#4","name":"api.addTodo"}` and six more lines (capped at five, `... +3 more E0015`), `fail shell 6 actions, 4 head (10.3s)`, exit 1.
- `--binary /work/no-such-binary`: `E0014 no shell binary at no-such-binary: run keel build --target tauri first`, exit 1. `--shell capacitor`: `E0014 --shell capacitor: the shell replay runs --shell tauri`, exit 1. `TAURI_DRIVER=/bin/false`: `E0014 tauri-driver did not answer on <port> within 20s (exit 1)`, exit 1, the api stopped.
- In the first container (no `--init`), exited WebKitWebDriver, app and Xvfb processes stayed as zombies because PID 1 there was `sleep`, which reaps nothing; no live process was left. With `--init` the list is empty.

`docker rm -f keel-shell-replay` afterwards; `docker ps -a | grep keel-shell-replay` prints nothing.

## What is and is not shown

Shown, on Linux WebKitGTK under Xvfb in Docker (arm64), with real input:
- "a recorded session": a session group recorded by `openGroup` at run time, written as a group file and read back for its inputs. It is user 0's half of the S4 race script, recorded as its own one-user group, not the two-user S4 group (see Design).
- "replayed inside the Tauri shell": the built debug binary driven through `tauri-driver` and WebKitWebDriver by element id, with trusted clicks and keystrokes; links followed by clicking them.
- "gives the server state its sim replay gives": the built api's stored `api.board` row equals `replayGroup`'s `api.board` after normalization (log times dropped; minted ids, write keys and callers numbered by first appearance). State, head, log names, payloads and entry ids are compared as they are.

Not shown:
- The Proposal 9 row's second half: stopping the API, toggling `t2` so the outbox queues it, restarting the app and the API, and seeing the write drain from the persisted outbox. Not built here; it needs the session to carry a network change the shell can make (or a stopped API) and is its own piece of work.
- The two-user S4 group itself, and user 1's offline writes, in the shell.
- x86_64: the proof ran on arm64; the CI runner is x86_64 (the earlier load check passed there).
- The CI run of the new steps: not pushed by this task.
- A field's clearing as a person does it: Element Clear empties the field from script, with an untrusted `change`.
- The artifact upload, macOS, Windows.

## Files

- `tooling/smoke/shell.mjs` (new), `tooling/smoke/shellReplay.mjs` (new), `tooling/smoke/webdriver.mjs` (new), `apps/golden-1/test/shellSession.ts` (new), `tooling/test/shellReplay.test.ts` (new)
- `tooling/ci-shell.mjs` (removed: folded into the smoke)
- `tooling/ci.source.json`, `.github/workflows/ci.yml` (generated)
- `tooling/smoke/README.md`, `docs/TESTING.md`
- No dependency added.
