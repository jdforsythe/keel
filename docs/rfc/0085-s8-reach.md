# RFC 0085: S8 Reach: durable storage, workflows, native shells and proofs

Status: accepted (2026-11-11); the user's answers are D1 to D7. Stage design RFC for S8 (`tasks/PROGRAM.md`, task 0338), written ahead of time; implementation waits for the S2 to S7 pushes and builds on RFC 0080's deployables, runners, jobs and deploy generator, RFC 0081's heads, write keys and `save` events, RFC 0082's charts, `explore` and ledger, and RFC 0083's policy and personal-data mark. RFC 0084 (S7, accepted) also edits std.statecharts; this RFC's edit applies after it, and the two share no other section, package or code block. It applies WORKFLOW RFC defaults 1 (five kernel gaps get kernel changes, K1 to K7, in four new kernel sections: k.persist, k.deploy, k.shell and k.prove), 2 (one storage capability with drivers instead of a database API beside `ctx.storage`; one flow model, charts, for workflows; one shell per platform family: Capacitor for mobile, Tauri for desktop), 3 (workflows run on std.jobs and std.statecharts, shell files ride the S3 deploy generator and its E1005 freshness check, stored-data checks ride k.compat's `accepts` and `--base`, the exit proof extends the `golden-1-api` eval), 4 (std.db stores only what `ctx.storage` already receives, never a secret, and writes no value to a log or diagnostic; workflow job inputs hold ids, not data), 5 (storage drivers, database URLs and workflow stores stay on the server; shells reach the server only at the origin the build names) and 6 (E1563, E1572 to E1575, E1605, E1606, E1715 to E1718, E2151 to E2153 and E2351 to E2354 enforce what prose would otherwise ask for) and 7 (`@keel/ctx`, `@keel/scaffold` and `@keel/testing` budgets are re-based; no threshold is lowered). ADR-0103 to ADR-0108 record it.

## Decisions (user, 2026-11-11)
- D1: the API shapes are accepted as a set: `ctx.storage.read` and `commit`; `createCtx({ drivers })`; `commitStores(ctx, factory, fn)`; `storage` and `shells` in `topology.ts`; `keel build --target capacitor|tauri [--platform] [--release]`; std.db's `sqlite(url)` and `postgres(url)`; std.workflows' `workflow`, step `run(data, ctx, { signal, key })`, `flows`, `stores` and `jobs`; std.statecharts' `next`; std.shells' `capacitorDrivers` and `tauriDrivers`; `prove(transactions, { rlimit })`. k.prove starts with the Z3 spike over golden-1's six board obligations (Lanes, verify).
- D2: golden-1 is migrated as Proposal 9 lists: `storage: 'sqlite'`, the list-removal workflow and its UI, two shells, `hidden` on lists and the `prove` test; the dev storage file is not carried over.
- D3: CI as Proposal 9 lists: Linux jobs per PR touching golden-1 (Tauri build and replay, Android debug APK) with a `postgres:17` service container pinned by digest; the Android emulator replay nightly once green on a developer machine; the iOS job on `macos-15` on manual dispatch only.
- D4: no signing, notarization or store upload in S8; artifacts are unsigned.
- D5: Keel hosts no Postgres; generated compose passes `KEEL_DATABASE_URL` and adds no Postgres service; CI uses a service container.
- D6: in a shell the caller cookie lives in the shell's native cookie store and is sent only to `KEEL_ORIGIN`; writes pass k.server's same-site check through the `x-keel: 1` branch. THREAT-MODEL's Caller identity entry gains the shell.
- D7: std.db stores `.pii` values as the store holds them, unencrypted by Keel; retention through `logLimit` and `secure_delete`, encryption at rest left to the host.

## Problem
S8 must take a Keel app past one process and one browser: state that survives restarts and replicas, multi-step processes that survive crashes, the same client running as a mobile and a desktop app, and claims at the `proven` rung for spaces `explore` cannot enumerate. Evidence from the code and the accepted RFCs as of this one:

1. **Storage has no atomic step.** `ctx.storage` is `get` and `set` (`packages/ctx/src/KeyValueStorage.ts`). k.server's read-set rule (409 when a store an action read was saved since) compares in-process copies (`saveStores.ts`: `sv.saved.get(o.key) !== o.from`), and its own comment says "a multi-store save is not atomic across keys". RFC 0080's Known limits ("one instance per deployable with runners") and RFC 0081's ("two instances over one storage keep last-write-wins") both hand this to S8.
2. **Storage is a file one process owns.** Production `ctx.storage` is Node's `localStorage` over `--localstorage-file` (RFC 0080 Dockerfile `CMD`), which is itself a SQLite file (measured: `file` reports "SQLite 3.x database" for a file Node 22.23 wrote). Nothing lets a deployable choose another backend, and nothing shares one between replicas.
3. **Background code cannot save a server store.** Stores are restored and saved only around an action (`openStores.ts`, `saveStores.ts`). RFC 0080's `digest.recount` job "saves `digest.latest`" with no kernel path for it, so a job writing state bypasses the read-set rule and the `save` events std.channels and std.monitor read.
4. **A deploy can strand stored data.** `restore` parses the log with the store's current payload schemas (`store.ts`, `logSchema(payloads)`), so renaming or removing a transaction makes every stored snapshot that holds it unrestorable, and k.server then throws on each request (`openStores.ts`: "saved snapshot does not restore"). Nothing checks a schema change against stored states before a deploy.
5. **No durable multi-step process.** std.jobs runs one function at least once; std.statecharts compiles one chart to one single-instance store. A checkout, a removal with an undo window or an approval needs many instances, steps with retries, timed waits and compensation, recorded so they can be replayed.
6. **The `shell` mode is empty.** `createCtx` says "`shell` delegates to the real implementations until native adapters exist" (`createCtx.ts`). In a native webview the page origin is `capacitor://localhost` or `tauri://localhost`, so relative API calls miss the server, `localStorage` can be evicted by the OS, and the client's offline outbox (RFC 0081) loses its queue.
7. **`proven` stops at finite spaces.** RFC 0082's closed-form `explore` needs every payload schema finite; golden-1's board (string ids, arrays) holds `exhaustive` at best. TESTING.md names SMT under `proven` "when it exists"; it does not.

## Proposal

### 1. The pieces and how they layer

| Piece | Where | Section | Built on |
| --- | --- | --- | --- |
| Atomic storage, drivers, saves across processes, `commitStores`, older snapshots | `@keel/ctx`, `@keel/server`, `@keel/store` | k.persist (new) | k.ctx `storage`, k.server Server state, k.sync heads |
| Builds and deploy files (moved from k.topology), `storage` per deployable | `@keel/compiler`, `@keel/server/start`, `@keel/scaffold` | k.deploy (new) | RFC 0080's generated entry and deploy generator |
| SQLite and Postgres drivers | `@keel/std-db` (new) | std.db (new) | k.persist drivers |
| Stored-data compatibility | `@keel/compiler`, `@keel/check` | k.compat (edited) | `surface.json`, `accepts`, `--base` |
| Workflows | `@keel/std-workflows` (new) | std.workflows (new) | std.jobs, std.statecharts, `commitStores` |
| Native shells: files, entry, build | `@keel/compiler`, `@keel/scaffold`, `@keel/cli` | k.shell (new) | k.deploy's generator, `client` entry, k.security policy |
| Shell drivers | `@keel/std-capacitor`, `@keel/std-tauri` (new) | std.shells (new) | k.persist drivers |
| Proofs by induction | `@keel/testing/prove` | k.prove (new) | k.model's store contract, k.ledger |

**One storage capability.** std.db is not a database API: it is two implementations of `ctx.storage`. Server stores, job queues, schedule marks and workflow stores already live in `ctx.storage` keys (RFC 0080 "What survives a restart"), so a driver moves all of them at once, and the S3 and S4 APIs stay as accepted. The kernel gains the operations that make sharing safe (`read`, `commit`) and the seam that chooses the implementation (`drivers`), and k.server's save becomes one `commit`, so the read-set 409 and S4's heads and write keys hold across replicas.

**One flow model.** A workflow is a std.statecharts chart run per instance in one server store: transitions are transactions, steps are std.jobs jobs that report back through `commitStores`, waits are delayed jobs, compensation is chart states. The store's log is the record of every instance, so replay, sessions, `explore` and `prove` apply with no new runtime.

**One shell per platform family.** Capacitor packages the `client` deployable for Android and iOS, Tauri for Linux, macOS and Windows. Each supplies `storage` and `net` drivers for `shell` mode; the app's `modules/` do not change.

### 2. Kernel changes
Exact text is in Spec diff; ADR outlines are below.

- **K1, k.persist in `@keel/ctx`: `read`, `commit`, drivers.** `ctx.storage` gains `read(keys)` (one cut) and `commit(writes)` (every key holds its `expect`, then every `value` is stored, else nothing; a write without `value` is a condition). `createCtx({ drivers: { storage?, net? } })` replaces a capability's implementation on a `real` or `shell` ctx and throws E1605 on `sim`, so simulation and replay stay the kernel's. Real, shell and sim each implement the two operations; under a k.sim schedule each is one storage call. A stdlib wrapper around `ctx.storage` would be a second storage path (default 1).
- **K2, k.persist in `@keel/server`: saves are one commit; `commitStores`.** A request restores a factory's stores from one `read`; an action's save is one `commit` whose `expect`s are the values restored and whose conditions are the opened unchanged keys, so the read-set rule and multi-store saves are atomic for every process sharing a driver. `commitStores(ctx, factory, fn)` gives runners and jobs the same path, re-running `fn` on a refused commit at most 3 runs in all, and reports `save` events (k.sync). The in-process copy stays an optimization keyed by the stored value; it no longer decides conflicts.
- **K3, k.persist in `@keel/store`: older snapshots.** `restore` of a snapshot whose state parses but whose log names an undeclared transaction or a refused payload keeps `state` and `head`, takes `state` as `initial` and keeps no entry. State and head are what the app needs after a deploy; the dropped entries are undo history the new code cannot replay.
- **K4, k.compat: stored data.** `surface.json` gains each server store's id, state schema and payload schemas; with `--base`, E1563 when the current state schema does not accept the base one (fix for one added required field: make it optional) and W1564 when a base transaction is gone or narrowed (its stored logs fold at the next restore, K3). The derived migration of an accepted change is the identity; every other change is refused before it ships.
- **K5, k.deploy (split from k.topology): `storage` per `node` deployable.** `'file'` (today), `'sqlite'` or `'postgres'`; the generated entry imports the std.db driver named and `start` opens it before listening; `DeployEnv` gains `KEEL_DATABASE_URL`; the Dockerfile and compose follow the choice; E1572 when the app lacks the package.
- **K6, k.shell: native shells.** `shells` on a `client` deployable; a shell entry creating `createCtx({ mode: 'shell', drivers })`; generated, read-only shell files; `keel build --target capacitor|tauri`, with `KEEL_ORIGIN` and toolchain checks first (E1573 to E1575); generated CI jobs.
- **K7, k.prove in `@keel/testing/prove` and k.ledger: `prove`.** An inductive proof of a store's invariants over its transactions with Z3, for functions in a declared fragment; a passing `prove` is `proven` evidence. Outside the fragment it rejects E1715 and claims nothing.

**Where the tokens come from.** k.topology (1,496 in RFC 0080, 2 under the cap) gives its Build and Deploy files paragraphs, E1560 and their two clauses to k.deploy, a split along its existing paragraph seam: 1,496 to 938. k.store (1,488 after RFC 0081) drops "`stores()` returns the live stores by id." (the Registries paragraph says what `stores()` reads) and gains a pointer to k.persist: 1,490. k.ctx (1,494 after RFC 0082) changes "`ctx.storage.get/set`" to "`ctx.storage` (k.persist)": 1,495. k.server (1,458 after RFC 0083) spends 21 of its 42 tokens of headroom: 1,479. k.compat 889 to 1,125, k.ledger 1,428 to 1,466, std.jobs 1,028 to 1,111, std.statecharts 1,298 (after RFC 0084) to 1,348. k.cli (1,500) is untouched: `keel build`'s row stands, and its `--target`, `--platform` and `--release` flags are k.shell's.

### 3. Package contracts
Every new file has one export, named as the file; schemas come first (`*.schema.ts`); every effect goes through `ctx` (`storage`, `net`, `clock`, `random`, `observe`), whose capabilities have real, shell and sim implementations; every state these pieces keep is JSON that parses with its schema (principle 10).

| Package | Files (exports) | Extension points | Codes |
| --- | --- | --- | --- |
| `@keel/ctx` (kernel) | `KeyValueStorage.ts` gains `read`, `commit`; `StorageWrite.ts` (type); `Drivers.ts` (type); `CtxOptions.ts` gains `drivers`; internal `realStorage`, `simStorage` gain both | capability registry (drivers for `storage`, `net`) | E1605, E1606 |
| `@keel/server` (kernel) | `commitStores.ts`; internal `openStores` (one `read`), `saveStores` (one `commit`); `./start` takes `storage` | none | E1551 widened, E1560 |
| `@keel/store` (kernel) | `store.ts` `restore` folds an unreplayable log | none | none |
| `@keel/compiler`, `@keel/scaffold`, `@keel/check` (kernel) | generated node entry imports the storage driver; shell entry; `surface.json` `stores`; deploy generator writes storage-specific Dockerfiles and shell files; rules E1563, W1564, E1572, E1573 | check rule registry (kernel rules) | E1563, W1564, E1572, E1573 |
| `@keel/cli` (kernel) | `build` input gains `target`, `platform`, `release`; internal `shellBuild`, `toolchain` | none | E1574, E1575 |
| `@keel/testing` (kernel) | `./prove`: `prove.ts`, `types/ProveOptions.ts`; internal `translate`, `sorts`, `z3` | none | E1715-E1718 |
| `@keel/std-db` (new) | `./sqlite`: `sqlite.ts`; `./postgres`: `postgres.ts`; internal `layout.ts` (std.db's own table versions), `openSqlite`, `openPostgres`; `./tools`: E2151 | storage drivers (k.persist), check rule registry | E2151-E2153 |
| `@keel/std-workflows` (new) | `workflow.ts`, `Workflow.ts` (type), `WorkflowSpec.ts` (type), `Instance.schema.ts`, `flows.ts`; internal `stepJob`, `wakeJob`, `forgetJob`, `scan`; `./tools`: E2351-E2354; `module.ts` (module `workflows`) | module manifest, inspector hook `workflows.instances`, check rule registry | E2351-E2354 |
| `@keel/std-jobs` | queue writes become `commit`s; leases end `timeoutMs` plus 1,000 ms after they start | (existing) | none new |
| `@keel/std-statecharts` | `next` on the chart | (existing) | none new |
| `@keel/std-capacitor` (new) | `capacitorDrivers.ts`; internal `preferencesStorage`, `capacitorNet` | storage and net drivers | none |
| `@keel/std-tauri` (new) | `tauriDrivers.ts`; internal `storeStorage`, `tauriNet` | storage and net drivers | none |

**Diagnostic blocks.** Kernel codes stay in their owner's block: E1605 and E1606 in E160x (k.ctx; RFC 0082 holds E1604); E1563, W1564 and E1572 to E1575 in E155x (k.server, k.topology, k.compat; RFC 0083 holds E1570 and E1571); E1715 to E1718 in E170x (k.testing; RFC 0082 holds up to W1714). The stdlib's E2xxx hundreds are all owned (E22xx and E29xx are fixture codes, `packages/check/conformance/define-rule.test.ts` uses E2901 to E2981; RFC 0084 may take E280x and E285x), and the wave-0 hundreds use only their first fifty: this RFC takes E2150 to E2199 for std.db (std.brands keeps E2100 to E2149) and E2350 to E2399 for std.workflows (std.i18n keeps E2300 to E2349). std.shells has no rules.

### 4. Storage semantics
**The contract.** `commit` is compare-and-set over several keys; `expect` compares whole values. A driver may compare a hash it stores beside the value; the contract is the values. `read` gives one cut, which is what k.server's "no request sees one store before a save and another after it" needs once two processes write. `get` and `set` stay for single-writer state; they are not a second path for the same operation: `set` has no precondition and `get` reads one key outside any cut.

**Drivers by mode.**

| ctx mode | `storage` | `net` |
| --- | --- | --- |
| `real` (Node) | `localStorage` over `--localstorage-file` (storage `'file'`), or std.db's `sqlite` or `postgres` driver | kernel `fetch` |
| `real` (browser) | `localStorage` | kernel `fetch` |
| `shell` | std.shells: Capacitor Preferences or Tauri's store file | std.shells: native HTTP, page origin mapped to `KEEL_ORIGIN` |
| `sim` | kernel, in memory; k.sim faults | kernel sim net |

**Processes.** Two `createApp`s on one sim ctx share its storage, which is how a test runs two processes deterministically; two real processes share a std.db driver's database. The in-process copy (`Served.saved`) is reused only when the stored value is the one it parsed, so a replica sees another's saves on its next `read`.

**Jobs across replicas.** std.jobs' queue is read-modify-`commit` with retry, and a lease ends `timeoutMs` plus 1,000 ms after it starts, so two replicas never run one job at once and a job leased by a crashed process runs again once its lease ends; `close()` frees the leases of the jobs it aborts, so a graceful restart runs them at once (RFC 0080's clause holds unchanged). std.schedules needs no change: a fire time's job key already deduplicates two replicas' enqueues.

**Migrations derived from schemas.** A store persists as its snapshot, so the data's shape is the store's state schema and its log's payload schemas, and k.compat derives what a deploy does to stored data from them:

| Change between base and current schemas | `keel check --base` | At the first restore after deploy |
| --- | --- | --- |
| Current state schema accepts the base one (an optional field added, an enum widened, a bound loosened) | nothing | restores as stored (identity migration) |
| A required field added, a field removed from a closed object, a type narrowed | E1563 at the field; fix for one added required field: make it optional | `restore` would return `err`, so the deploy is refused first |
| A transaction removed or renamed, or its payload narrowed | W1564 | log folded: `state` and `head` kept, entries dropped (K3) |

std.db's own tables are versioned by std.db (`keel_meta.layout`) and upgraded in one transaction at open; app schemas never become columns or DDL (Alternatives). A change that needs a value computed from the old state has no derived migration; Known limits says what an app does then.

### 5. Workflow semantics
Each workflow is one server store (`workflow(id, ...)`), so its instances are restored, saved, logged, pushed (std.channels `saved`), recorded and replayed as any server store.

- **Transitions.** `start`, one transaction per chart event, `attempt` and `forget`; each changes one instance. An instance's `{ state, data }` moves only by the chart's `next` (std.statecharts, made public here), so the per-instance transition is the chart's and the chart's closed-form `explore` proves per-instance invariants for every instance (reduction by independence: no transaction reads another instance).
- **Steps.** Entering a step state makes the runner enqueue `<id>.<state>` with key `<id>:<flow>:<entered>`. The generated job checks that the instance is still there, commits `attempt`, calls `run(data, ctx, { signal, key })` and commits `done` with the `ok` value; on the last attempt an `err` commits `failed` `{ code }`. The job's std.jobs `attempts` is the step's plus one, so a `run` that hangs past every timeout ends in `failed` `{ code: 'workflows.attempts' }` rather than silently in std.jobs' failure list.
- **Waits.** Entering a wait state enqueues `<id>.wake` after `ms`; the wake commits the wait's event only if the instance has not moved. External events come from the app's own actions, under its guards: std.workflows adds no route.
- **Crashes.** Every point between two commits is covered by at-least-once jobs and keyed, entered-checked commits: a crash before `done` reruns the step with the same `key`; a crash after it finds the instance moved. The runner rescans every 60,000 ms and at start, so an instance another replica saved, or one saved in the moment before a crash, is picked up.
- **Replay.** Step outcomes are payloads of `done` and `failed` entries, so replaying the log reproduces every instance without running a step, and std.sessions, `explore` and `properties` work on the workflow store as on any store.
- **Compensation** is states: a `failed` event leads to states whose steps undo earlier ones; W2353 names a failure that ends an instance after another step succeeded on the way.

### 6. Shells
**Mobile and desktop.** `shells.capacitor` builds Android (Gradle) and iOS (Xcode) apps; `shells.tauri` builds Linux, macOS and Windows apps. Tauri 2 can also build mobile apps; S8 does not use that path, so each platform has one way (Alternatives).

**Origin.** The build bakes `KEEL_ORIGIN` into the shell entry. The `net` driver sends the page's own-origin requests there through the native HTTP client, so `service({ module })`, golden-1's `location.origin` calls and std.offline's outbox reach the server unchanged. Native HTTP sends no `Sec-Fetch-Site`; k.services already sends `accept: application/json` with `x-keel: 1`, which k.server's same-site check admits, and a shell page has no cross-site navigation for that check to stop. Tauri's generated capability allows `plugin-http` to reach `KEEL_ORIGIN` only.

**Storage.** Capacitor Preferences (UserDefaults, SharedPreferences) and Tauri's store file survive OS storage pressure that may clear a webview's `localStorage`, which is where std.offline keeps a queued write.

**Policy.** Tauri applies the deployable's k.security policy from `tauri.conf.json`, with Tauri's IPC origin added to `connect-src`; Capacitor's `index.html` carries it as a meta tag. Both shells load only the built files; nothing loads from the network but the API.

**What a shell build needs** (verified 2026-11-10; Proposal 8 lists sources):

| Shell, platform | Tools | Runs where |
| --- | --- | --- |
| Tauri, Linux | Rust 1.95+ (`tauri` 2.12.5 requires it), `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` | GitHub `ubuntu-24.04` (Rust 1.99.1 preinstalled; packages by apt) and a developer machine |
| Tauri, macOS and Windows | Rust; Xcode command line tools; WebView2 | developer machine |
| Capacitor, Android | Node 22+, JDK 21, Android SDK (API 36, min 24) | `ubuntu-24.04` (SDK preinstalled, JDK 21 installed beside the default 17) and a developer machine |
| Capacitor, iOS | macOS, Xcode 26 | `macos-15` (Xcode 26.x installed beside the default 16.4) on manual dispatch, and a developer machine |

### 7. Proofs
`prove` translates the source of each transaction and invariant function into SMT over sorts derived from the schemas and asks Z3 whether a state satisfying the invariants and a valid payload can produce a state that breaks one. `unsat` for every transaction, plus `initial` passing `check`, is an induction proof. A `sat` model is printed as a counterexample state and payload; it may be unreachable, which means the invariant is true but not inductive, and the message says so. A verdict uses Z3's resource limit, a count, not wall time, so it repeats on any machine with the same Z3.

The fragment is chosen to cover golden-1's transactions and invariant as written: `some`, `every`, `map`, spread-append and `new Set(xs.map(f))` with `.size` and `.has`. `filter`, loops and calls are outside; golden-1's `api.purgeList` uses `filter` and stays at `exhaustive` through `explore`. `explore` remains the engine for finite spaces and for reachability (`coverage`); `prove` is for invariants over unbounded domains.

### 8. Privacy and auth
- **What std.db writes to disk** is exactly what `ctx.storage` receives today (std.db On disk). No secret: `store()` refuses `s.secret` in state (E1303), `snapshot()` folds a secret payload, std.jobs refuses one in an input (E2503), std.workflows' job inputs hold `{ id, entered }` only. Personal data marked `.pii` is persisted as the store holds it, because k.privacy defines the app's stores as where personal data lives and sessions, logs, error text and the bundle as the sinks it is redacted from (default 4: the database is not a sink). std.db never writes a value to a log line or diagnostic. Retention is the store's: a removed value leaves with its last log entry past `logLimit`; SQLite overwrites freed pages (`secure_delete`).
- **The database URL** is a secret: read only from the environment by the generated entry, never in a generated file (compose passes `${KEEL_DATABASE_URL:?}`), never printed (E1560 and E2153 name the key).
- **Server-only** (default 5): drivers, `commitStores`, workflow stores and runners run only in `node` deployables (E1551, E2351, std.jobs' E2504).
- **Shells.** The caller cookie (k.security) lives in the shell's native cookie store and is sent only to `KEEL_ORIGIN`; the shell sends nothing to another origin unless app code names one. The page loads no remote code.
- **Open gap that S8 raises.** Backlog 0257: a `*.server.ts` action that passes `reveal(...)` into a payload puts plaintext into state and the snapshot. With std.db that snapshot is durable and shared; the orchestrator should schedule 0257 before the S8 batch (Lanes).

### 9. Exit proof and golden-1
The exit proof extends `evals/tasks/golden-1-api` (default 3): `pnpm eval --task golden-1-api --runner none --strict`, its hidden acceptance test (sim) and `pass.ts` (built processes), plus three smokes `pass.ts` runs. Stated as one criterion: **golden-1 on std-db survives SIGKILL with byte-equal stored state on SQLite and on Postgres, a list removal resumes after a SIGKILL inside a step and ends once, golden-1's `web` ships from CI as a Tauri Linux binary and an Android debug APK, a recorded session replayed inside the Tauri shell gives the server state its sim replay gives, and the board's map-based transactions are `proven`.**

**golden-1 changes** (D2).
- `topology.ts`: `api: { modules: ['api', 'digest'], adapter: 'node', storage: 'sqlite' }`; `web: { modules: ['todos'], adapter: 'client', shells: { capacitor: { id: 'dev.keel.golden1', name: 'Golden 1' }, tauri: { id: 'dev.keel.golden1', name: 'Golden 1' } } }`.
- `api`: `TodoList` gains `hidden: s.boolean().optional()` (an accepted change: no E1563); transactions `api.hideList`, `api.showList`, `api.purgeList` (removes a list and its todos); `RemovalData.schema.ts` (`{ list: s.id('TodoList') }`), `removalChart.ts` (`hidden` on `expired` to `purging`, on `undo` to `restoring`; `purging` on `purged` to `removed`, on `purgeFailed` to `restoring`; `restoring` on `restored` to `kept`, on `restoreFailed` to `stuck`; `removed`, `kept`, `stuck` final), `removal.server.ts` (steps `purging` and `restoring`, wait `hidden` 600,000 ms), `purgeList.server.ts` and `restoreList.server.ts` (`commitStores` on `boardStores`), `jobs.server.ts`, `runners.server.ts`; `boardStores` adds the `api.removal` store, so hiding a list and starting its removal is one `commit`; routes `api.removeList` (`POST /api/lists/:id/remove`) and `api.undoRemoval` (`POST /api/removals/:flow/undo`); `loadBoard` returns open removals.
- `todos`: a remove Button per list (`todos.remove.<list>`) and an undo bar (`todos.undo.<flow>`).
- Tests: `test/removal.test.ts` (sim: the wait, the undo, three failed purges compensated by `restoring`, a restart during `purging`), `test/removalChart.explore.test.ts` (closed-form `explore`, `coverage` empty), `test/board.prove.test.ts` (`prove` over `addList`, `addTodo`, `toggleTodo`, `editTodo`, `hideList`, `showList`).
- `package.json`: `@keel/std-db`, `@keel/std-workflows`, `@keel/std-capacitor` with `@capacitor/core`, `@capacitor/preferences`, `@capacitor/android`, `@capacitor/ios`, `@keel/std-tauri` with `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-http`; dev: `@capacitor/cli`, `@tauri-apps/cli`, `z3-solver`. Generated: `deploy/web/capacitor/`, `deploy/web/tauri/` (and `Cargo.lock` after the first build), the `sqlite` Dockerfile.

**What runs where.**

| Check | CI (`ubuntu-24.04` unless noted) | Developer machine |
| --- | --- | --- |
| Sim acceptance test: removal flow, restart during a step, two apps on one ctx (read-set 409 across processes), jobs run once across two runners | every PR (`pnpm eval`) | yes |
| `tooling/smoke/restart.mjs`, SQLite: build, run the S4 HTTP script against `node dist/api/server.mjs`, read `keel.store.api.board` from the file with `node:sqlite`, SIGKILL, restart, assert byte-equal row, equal GET, next head one higher | every PR | yes |
| Same smoke, Postgres: a copy with `storage: 'postgres'` (topology edit only) against a `postgres:17` service container pinned by digest | every PR, Linux service container | with Docker or a local Postgres |
| `tooling/smoke/workflow.mjs`: start a removal, undo it in a copy whose `restoreList` waits 2,000 ms on `ctx.clock` with `timeoutMs: 3000`; SIGKILL once the stored instance shows `attempt` 1; restart; within 10 s the instance is `kept`, the list is visible once, and the log replayed from `initial` equals the stored state | every PR | yes |
| Tauri: `keel build --target tauri` (apt packages, `tauri-driver` pinned and cached), `tooling/smoke/shell.mjs --shell tauri` under `xvfb-run`: applies user 0's `fire` and `nav` inputs from the S4 group session to the shell over WebDriver by element id, then compares the server's `api.board` with `replayGroup`'s (ids normalized by first appearance); stops the API, toggles `t2` (outbox queues it), quits the app, starts the API and the app, and sees the write drain from the persisted outbox | every PR touching `apps/golden-1`, artifact uploaded | Linux; macOS and Windows build only (no WebDriver for WKWebView) |
| Capacitor Android: `keel build --target capacitor --platform android` (debug APK) | every PR touching `apps/golden-1`, artifact uploaded | yes |
| Capacitor Android replay: the same shell smoke on an emulator (KVM, `reactivecircus/android-emulator-runner` pinned by SHA) through Chromedriver's WebView mode | nightly once it holds green on a developer machine (D3) | yes, first |
| Capacitor iOS: simulator build without signing, replay through Appium's WebView context | manual dispatch on `macos-15` | yes |
| `prove`: `board.prove.test.ts` in `pnpm test`; `keel ledger --scope golden-1: --format=json` shows the six transactions at `proven` (S5 gave `exhaustive`) | every PR | yes |

**What the eval asserts** (added to `pass.ts` and the hidden acceptance test).
- Restart: the stored row before SIGKILL and after restart are byte-equal for both drivers; `head` and every log entry's `id`, `base` and `key` are kept; the next write's entry `id` is one higher.
- Planted migration twins: making `TodoList.hidden` required is one E1563 under `keel check --base <shipped .keel/surface.json>` whose fix restores the optional; removing `api.editTodo` is one W1564, and the restarted process restores the old database with `state` and `head` equal and an empty log.
- Workflow: the sim test passes; the built crash run ends `kept` with `restoreList` run twice and one `api.removal.restored` entry in the log.
- Shells: both artifacts exist and are uploaded; the Tauri replay's normalized server board equals the sim replay's; the drained write is on the server after the app restart.
- Proofs: the six transactions are `proven`; a planted `addTodo` without its duplicate-id check rejects E1716 with a counterexample whose state holds the payload's id; adding `api.purgeList` to the `prove` list rejects E1715 naming `.filter`.

### 10. Platform facts (verified 2026-11-10)
- **Node.** `node:sqlite` exists unflagged from 22.13.0 (added 22.5.0); measured on this machine: Node 22.16.0 (SQLite 3.49.1) and 22.23.1 (3.51.3) open a database and run `BEGIN IMMEDIATE` with one `ExperimentalWarning`; Node 24.19.0 (3.53.3) prints none (stability 1.2). Node 22 ends 2027-04-30; Node 24 and 26 are LTS. The Dockerfile keeps `--disable-warning=ExperimentalWarning`.
- **Postgres.** `pg` 8.23.1 (pure JavaScript; `pg-native` optional, marked external when bundling); `postgres` 4.1.0 (zero dependencies, released 2026-11-05); `@electric-sql/pglite` 0.5.16 (PostgreSQL 18.6 in WASM, 26.3 MB unpacked, one connection, in memory by default).
- **Capacitor** 8.6.0 (`@capacitor/core`, `@capacitor/cli`; 8.0.0 on 2025-12-08): Node 22+, Xcode 26, Android Studio 2025.2.1 with SDK API 24 to 36, Java 21; origins `capacitor://localhost` (iOS) and `https://localhost` (Android); `@capacitor/preferences` 8.0.1; `CapacitorHttp` in core patches `fetch` only when enabled, which the driver does not do.
- **Tauri** 2: `@tauri-apps/cli` 2.12.4, `tauri` crate 2.12.5 (Rust 1.95), `@tauri-apps/plugin-store` 2.5.1, `@tauri-apps/plugin-http` 2.9.0 (exports `fetch`; needs `http:default` and allowed URLs); `tauri build --debug --no-bundle` exists; `tauri-driver` supports Linux and Windows, not macOS.
- **GitHub runners.** `ubuntu-24.04`: Rust 1.99.1, Android SDK, JDK 17 default with 21 installed, PostgreSQL 16 installed but stopped, Docker; service containers on Linux only; KVM for emulators after a udev step. `macos-15`: Xcode 16.4 default with 26.x installed. macOS minutes cost about ten times Linux minutes.
- **Z3.** `z3-solver` 5.4.0 (MIT, published 2026-11-10; the lane pins the newest release at least two weeks old), 40.1 MB unpacked of which 39.2 MB is WASM; Emscripten threads, so Node needs `SharedArrayBuffer` (present) and `killThreads` at the end; bundlers break its worker loading, so it stays an unbundled Node dependency.
- **Not verified here.** That `xcodebuild` with `CODE_SIGNING_ALLOWED=NO` builds a Capacitor 8 simulator app on `macos-15`, and that `pg` bundles into `server.mjs` with `pg-native` external: each lane proves its item in its first commit.

## Alternatives
- **A database API beside `ctx.storage`** (a `db(ctx).query`, or a store backend interface in k.store). Two storage paths, and jobs, schedules and workflows would stay on the file (default 2). Drivers move every key at once and keep stores the one state model.
- **Tables per store with a column per schema field** (an ORM-style mapping and generated DDL). A second representation of the snapshot to keep in step with the log and heads; queries would bypass transactions and the log (principles 1, 10). Rejected; std.db stores snapshots, and k.compat checks schema changes against them.
- **An append-only table of every log entry.** Keeps history past `logLimit` for audit, and personal data with it, with no erasure path (default 4). A later RFC can add it with a retention schema.
- **better-sqlite3** 13.0.3 (prebuilt native addon for 8 targets). A `.node` file cannot be bundled into `server.mjs`, and the image would need the matching prebuild; `node:sqlite` is in the runtime the image already has.
- **postgres.js** 4.1.0. Zero dependencies and ESM, but its current major is five days old; `pg` 8 has kept its API for years and is what most Node Postgres code runs on. Revisit at the next driver change.
- **Postgres LISTEN/NOTIFY for `save` events across replicas.** Would lift std.channels' one-process fan-out (RFC 0081). It needs a driver event channel in k.persist and a broker contract; S8 keeps fan-out per process (Known limits).
- **A workflow engine with its own runtime** (Temporal, or deterministic re-execution of workflow code). Replay by re-running code needs every effect and branch to be deterministic code Keel cannot check, and a second runtime beside stores; a chart run per instance is logged by construction.
- **One chart store per workflow instance** (RFC 0084's `instance(chart, key)`). An instance store lives in the calling scope and a server factory opens a fixed set of store ids per request, so a runner scanning every instance would open one key per instance; one store per workflow keeps ids static at the cost of one snapshot holding every instance (Known limits).
- **Re-implementing retries in the workflow runner.** A second lease, backoff and timeout beside std.jobs' (principle 1).
- **Tauri Mobile for Android and iOS.** One shell for every platform, but it needs Rust and the Android NDK for mobile builds, its docs state no stability level for mobile, and Capacitor's Preferences and native HTTP ship in its core and official plugins. Capacitor for mobile and Tauri for desktop gives one way per platform family.
- **The webview's `localStorage` in shells.** iOS can clear it under storage pressure, which would drop queued writes.
- **Committing Capacitor's `android/` and `ios/` projects.** Thousands of generated native files a person would edit by hand; Keel generates the config and stages the native project per build.
- **`keel build` running native tools by default.** Every build would need Xcode or Rust; `--target` keeps the default build hermetic.
- **Bounded verification only** (small-scope enumeration). It claims `exhaustive`, which `explore` already gives; it cannot reach `proven` for unbounded domains.
- **Z3 for every transaction** (symbolic execution of arbitrary TypeScript). Unsound at the edges it cannot model; a declared fragment that rejects what it cannot translate (E1715) claims only what it proves.
- **TLA+, Alloy or Dafny models.** A second model of the app in another language, and a JVM or .NET toolchain (RFC 0082 rejected the same for model checking).

## Spec diff
Token counts are `ceil(length / 4)`, the rule `tooling/budgets.mjs` uses, measured on copies of each section with RFC 0079 to RFC 0083's accepted text applied (k.store after RFC 0081: 1,488; k.ctx after RFC 0082: 1,494; k.server after RFC 0083: 1,458; k.topology, k.compat and std.jobs as RFC 0080 wrote them; k.ledger after RFC 0083: 1,428, which RFC 0084 does not edit; std.statecharts after RFC 0084: 1,298). k.compat (889), k.topology (1,496) and std.jobs (1,028) are measured on the committed `spec/`, which matches RFC 0080's text byte for byte; RFC 0083 and RFC 0084 edit none of them. New clauses are appended to existing Conformance lists, so no existing clause renumbers except k.topology's, whose two moved clauses leave it.

| Section | Before | After |
| --- | --- | --- |
| k.store | 1,488 | 1,490 |
| k.ctx | 1,494 | 1,495 |
| k.server | 1,458 | 1,479 |
| k.topology | 1,496 | 938 |
| k.compat | 889 | 1,125 |
| k.ledger | 1,428 | 1,466 |
| std.jobs | 1,028 | 1,111 |
| std.statecharts | 1,298 | 1,348 |
| k.persist (new) | | 1,062 |
| k.deploy (new) | | 979 |
| k.shell (new) | | 1,187 |
| k.prove (new) | | 929 |
| std.db (new) | | 947 |
| std.workflows (new) | | 1,356 |
| std.shells (new) | | 526 |

### k.store (1,488 to 1,490)
- API: "Heads, a write's `base` and `key`, and `transaction(..., { concurrent })`: k.sync." becomes "...: k.sync; restoring snapshots older code stored: k.persist."
- Trim: "`stores()` returns the live stores by id." (the Registries paragraph states what `stores()` reads).

~~~md
# k.store: Store and transactions
status: conformance-covered

**API.**
```ts
export const cart = store(CartSchema, { items: [] })
export const addItem = transaction(cart, 'cart.addItem', AddItem, (st, { item }) => ({ ...st, items: [...st.items, item] }))
```
Reads: `cart.get('items')`, `cart.select(fn)` as computeds. Writes: only via `tx(addItem, payload, { meta, base, key }?)`; `payload` is typed by the transaction's schema, so a payload of another type is a compile error; one typed `unknown` compiles and is validated at run time. Log: `cart.log()` ordered entries `{ name, payload, at, id, meta? }`; `cart.snapshot({ meta }?)`, `cart.restore(snap)`, `cart.undo()`, `cart.undoWhere(pred)`. `cart.check(state)` returns `Result<T, KeelError<'store.invariant'>>`: ok iff `state` parses with `schema` and every `invariant` holds, without committing or logging. A store exposes readonly `schema`, `id` and `payloads`; a transaction exposes readonly `schema` and `store`. `snapshot()` is `{ state, log, initial, head }`. Heads, a write's `base` and `key`, and `transaction(..., { concurrent })`: k.sync; restoring snapshots older code stored: k.persist.

**Ids and invariants.** `store(schema, initial, { id, clock?, logLimit? })`: `id` is the stable store id `<module>.<export>`; the compiler fills it from the export name when omitted (runtime default `store.<n>` from a module counter); it keys `state()` in the harness and the `k-state` snapshot. **Registries**: `isolate(scope)` gives a scope its own registry; `store()` registers in, and `stores()` reads, the registry of the nearest isolated scope on the `owner()` chain, else the module registry, so a duplicate live id throws only within one registry (the server isolates each request scope). `invariant(store, fn)` declares a predicate over state checked after every transaction; a violation returns `err` with code `store.invariant` and rolls back; it is declared once, next to the store. A payload failing its schema returns `err(schema.invalid)`; an undeclared transaction returns `err` with code `store.undeclared`. Log entry `at` comes from `clock` (default: a counter); never from `Date`.

**Log meta**. `meta` is a record of JSON values with no schema, copied and frozen onto the entry; it never enters state, and non-JSON meta returns `err(schema.invalid)` with nothing committed. Snapshots reach clients (`#k-state`), so `snapshot()` drops `meta` from every entry; `snapshot({ meta: true })` keeps it and `restore` keeps the `meta` of the entries it restores. `undoWhere(pred)` undoes the latest entry when `pred(entry)` holds for it and returns whether it did; it never undoes an older matching entry.

**Log limit**. A store keeps at most `logLimit` entries (default 256; not a non-negative integer: `store` throws). A commit past it folds the oldest entry into the base `undo` replays from, which `snapshot()` returns as `initial`; `restore` folds a longer log the same way. State is unchanged. `undo` and `undoWhere` reach only kept entries: with none left they return `false` and change nothing.

**Secrets**. `tx` keeps a payload's `s.secret` values; `snapshot()` folds every entry up to the last holding one into `initial`. `store()` throws E1303 on a state schema holding `s.secret`.

**Ownership.** A component declares `uses: [addItem]`, bound to the declaring scope (`owner()`); `tx` consults the declarations of the calling scope and its ancestors, and a caller with none in its chain is unrestricted. Calling an undeclared transaction from a component is E1301; loaders and actions (k.router) run outside component scopes and are unrestricted.

**Rules.** E1302 `ctx` or global access inside a transaction function · E1303 `s.secret` anywhere in a store's state schema, or a `reveal` call in a transaction function. Partial (static): skips unresolved schemas, chains past 8 consts, `reveal` in helpers.

**Conformance.**
- Transactions are deterministic for equal inputs.
- Log replay reproduces state.
- Undo is exact inverse.
- Snapshot round-trips through JSON.
- `restore` replaces the base `undo` replays from with the snapshot's `initial`.
- Of two sibling scopes, the one declaring `uses` is restricted and the other is not.
- `stores()` lists stores whose owning scope is live and drops one on disposal.
- A duplicate live id throws.
- Two isolated scopes each hold a live store with the same id, `stores()` under each lists only its own and outside both lists neither.
- `check(state)` returns ok iff every invariant holds and never changes state or log.
- `store.schema` parses every state the store accepts and `transaction.schema` parses every payload `tx` accepts.
- A payload not assignable to the transaction's payload type is a compile error and an `unknown` one compiles.
- `tx` with `meta` logs it on the entry and leaves state as without it.
- Non-JSON meta is `schema.invalid` and changes nothing.
- `snapshot()` entries carry no `meta`, and `restore(snapshot({ meta: true }))` reproduces the log with its meta.
- `undoWhere(pred)` undoes exactly when the latest entry satisfies `pred` and otherwise changes nothing.
- After more than `logLimit` commits, `log()` holds the latest `logLimit` entries, replaying them from `snapshot().initial` reproduces state, and `undo()` returns `true` exactly `logLimit` times.
- `restore` of a snapshot whose log exceeds `logLimit` keeps its state and its latest `logLimit` entries.
- An effect reading `stores()` reruns when a store is created and when its scope is disposed.
- `payloads` maps each transaction declared on a store to that transaction's `schema` and holds no other name.
- A payload's `s.secret` value is `reveal`able in `log()`; `snapshot()` then holds no secret and restores the same state.
- E1303 fires on a nested `s.secret` in a state schema and on `reveal` in a transaction function, not on clean twins.
- `store()` throws E1303 on a state schema with a nested `s.secret`, not on its clean twin.
~~~

### k.ctx (1,494 to 1,495)
- API: "`ctx.storage.get/set`" becomes "`ctx.storage` (k.persist)".

~~~md
# k.ctx: Capabilities
status: conformance-covered

**API.** `ctx.clock.now()`, `ctx.clock.after(ms, signal?): Promise<void>`, `ctx.random.float()`, `ctx.random.id(brand): Id<B>` (a fresh v4 uuid typed as `s.id(brand)`; the one way to mint an id or token), `ctx.net.fetch(req)`, `ctx.storage` (k.persist). Registry: `register(name, { real, shell, sim })` with factories `(opts: { seed }) => Impl`; returns a typed accessor `(ctx) => Impl`, the only access path; resolution is lazy, so `createCtx` and `register` run in either order; each factory's seed is derived from the ctx seed and the name; `capabilities()` lists names; re-registering with the identical implementations object returns the same accessor; any other duplicate is E1602. Sim mode, schedules and plans: k.sim.

**Observers.** `observe(ctx, fn): () => void` calls `fn` synchronously with each event the kernel reports on `ctx`, in order, until the returned function runs; a throw in `fn` is dropped. Events (`CtxEvent`): `{ kind: 'nav', href, route: { id, path, params, search, schemas } }` when the router starts a navigation, before guards, or `resume` restores the served route (`params`, `search` encoded; no `schemas`); a new observer first gets the current one, then the `error` events reported since it (the first 16), both replayed with `at`, their report time; `{ kind: 'fire', id, event }` when runtime-dom dispatches a `FireEvent` to element `id`, before its handlers (on a field ever `type="password"` or `autocomplete` `current-password`/`new-password`, for the rest of the ctx, an `input` value and a one-character `keydown` key are `x` repeated); `{ kind: 'resource', id, state }` when `Match` renders a resource state (`id`: its `inspect()` node id); `{ kind: 'error', error }` when a `Boundary` catches or a loader or action returns `err`; `save` and `net`, with `ctx.net.online()`: k.sync. `seedOf(ctx)`: the seed `createCtx` was given.

**Rules.** Ambient clock, random, net, and storage effects in app code are E1601: `Date` (`Date.now`, `new Date()`, `Date()`), `Temporal.Now`, `Intl.DateTimeFormat` `format()`/`formatToParts()` with no date, `performance.now`/`timeOrigin`, `Math.random`, `crypto.randomUUID`/`getRandomValues`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch`, `navigator.sendBeacon`, `XMLHttpRequest`/`WebSocket`/`EventSource`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`. They are found through `globalThis`/`window`/`self`, a literal computed key (a `const` string too), and same-file bindings (aliases, parameter defaults, destructuring), each name resolved by lexical scope. An alias is reported at its uses, not where it is declared, unless it is exported there. The fix is the `ctx` equivalent where one is exact; `crypto.randomUUID` names `ctx.random.id(brand)` without a fix. E1603 `eval`, `Function(...)`, or `new Function(...)` in app code, also aliased or as a function's (or its prototype's) `constructor`, and `import()` or `new Worker`/`SharedWorker` (also `Reflect.construct`) of a `data:` or `blob:` URL. E1603 follows a URL through `String()`, templates, `+`, `new URL`, `?:`, object literal properties and each value assigned to a local, and a function's prototype chain to its `constructor`. Neither follows values through calls or another file; E1601 also not through object literals or a reassigned binding.

**Conformance.**
- `after(ms)` under sim resolves exactly when `advance` crosses the deadline, never before, and an aborted waiter rejects.
- `random.id(brand)` under sim is deterministic by seed and parses with `s.id(brand)`; `random` has no `uuid`.
- Ctxs created before and after `register(name)` both reach it in real, shell, and sim.
- Simulated implementations are deterministic by seed.
- Every capability has all three implementations.
- In `keel test`, a ctx created with no options is sim, with seed 0.
- `const D = Date; D.now()`, `` Date[`now`]() ``, and `const { random } = Math; random()` are each one E1601, at the call; after `const Date = ctx.clock`, `Date.now()` is not E1601.
- For an alias chain of depth 1 to 4 to `Date.now` or `Math.random`, E1601 is reported exactly once, at the call.
- `eval(s)`, `Function(s)`, `new Function(s)`, and `const e = eval; e(s)` are each one E1603; a locally declared `Function` is not.
- `Temporal.Now.instant()`, `performance.timeOrigin`, `navigator.sendBeacon(u, b)`, and `new Intl.DateTimeFormat('en').format()` are each one E1601; `.format(d)` is not.
- `(() => {}).constructor(s)`, `(async () => {}).constructor(s)`, `Function.prototype.constructor(s)`, and `import('data:text/javascript,' + s)` are each one E1603; `import('./a.ts')` is not.
- `import(URL.createObjectURL(b))`, `new Worker(URL.createObjectURL(b))`, `new Worker('data:,' + s)`, and `Object.getPrototypeOf(async function () {}).constructor(s)` are each one E1603; `new Worker('/w.js')` is not.
- `import(String(URL.createObjectURL(b)))`, `` import(`${URL.createObjectURL(b)}`) ``, `new Worker(new URL(URL.createObjectURL(b)))`, `Reflect.construct(Worker, [URL.createObjectURL(b)])`, `import(u)` after `let u; u = URL.createObjectURL(b)`, and `Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)` are each one E1603; `new Worker(new URL('./w.js', import.meta.url))` is not.
- Under a sim ctx, a navigation, a `fire`, a resource state and a `Boundary` catch each reach `observe` once, in order; a password field's `input` value arrives as `x` repeated, also after its `type` changes; an observer added after a navigation gets it first, one that throws stops no other, and none gets an event after its stop function runs.
- An `error` reported while nothing observes reaches a later observer right after the current `nav`, at most the first 16 since it; one reported before a later `nav` does not.
- A replayed `nav` or `error` carries `at`, its report time; a live one has none.
- `seedOf(ctx)` is the seed given to `createCtx`, and `undefined` when none was given.
~~~

### k.server (1,458 to 1,479)
- API: "Apps import only `topology` from `@keel/server`;" becomes "Apps import only `topology` and `commitStores` (k.persist) from `@keel/server`;".
- Server state: "(409 `keel.conflict`);" becomes "(409 `keel.conflict`), in one `commit` (k.persist);".
- Build: "Builds, runners, peers, `keel dev`: k.topology." becomes "Builds: k.deploy; runners, peers, `keel dev`: k.topology."
- Rules: "E1551 `loader`/`action` outside `*.server.ts`" becomes "E1551 `loader`/`action`/`commitStores` outside `*.server.ts`".

~~~md
# k.server: Thin server
status: conformance-covered

**API.** Apps import only `topology` and `commitStores` (k.persist) from `@keel/server`; `loader`/`action` (`@keel/router`) run over HTTP.
- `loader({ output, params?, search?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>` encoded with `output`.
- `action({ input, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }` and `ctx`; returns `Result<Href | null, KeelError>`; routes bind it by method (`routes.actions`, k.router).
- `params`/`search` are `Infer` of the declared schemas (else `unknown`), the route's own (E1507); `fn` is never annotated; `url` is absolute.
- A loader whose `fn` is an async generator is live (E1558): a document or JSON GET takes its first yield, an event-stream GET all; args add `signal`.

**Server state.** `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once, restoring its stores from `ctx.storage` `keel.store.<id>`; `fn` gets `S`. An action's `ok` saves its changed stores unless another request saved any of the factory's since (409 `keel.conflict`), in one `commit` (k.persist); `err` or a throw saves none; saves reach `observe` (k.sync). `caller` is the base64url SHA-256 of the cookie token, HMAC-signed with `createApp({ secret })` (<32 bytes: E1556; default per process, W1556 in production); `tx` meta `{ caller }` scopes `undoWhere`. Factory stores skip `#k-state` and inspect; server code never writes module stores; client routers refuse `stores`.

**Request flow.** Match routes -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the chain's loaders concurrently, then stream HTML. A loader `err` renders the route's `errorElement`.
- GET with `accept: text/event-stream` to a live loader's route: guard denial 403 `keel.denied`, else a `data:` line per yield (its `Result` JSON), a `:` line per 15 s of `ctx.clock`, until `fn` returns or `signal` aborts (request abort, `close()`). Other routes: 406.
- POST, PUT, PATCH, DELETE: first the same-site check (`Sec-Fetch-Site` `same-origin`/`none`, its own `Origin`, `accept: application/json` with `x-keel: 1`, or neither; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData or JSON (empty: `{}`) by `input` (fail: `keel.fields`, not called), run it, 303 to the target (document) or `Result` JSON (runtime).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · other `err` 400 · uncaught throw 500 `keel.unexpected` (production: message `unexpected`, no stack). `mode` defaults to `production`. `#k-state` holds every request-scope store.

**Document.** Each route level is a candidate island root by route id. Head, `<html lang>` and the `keel.notFound` alert: k.head. Headers, the policy, the caller cookie and `/__keel/csp`: k.security.

**Build.** Builds: k.deploy; runners, peers, `keel dev`: k.topology. Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup, scripts its entry, serves `/assets/*` and `/keel-mark.svg` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag); dev, or no `assets` in development/test, serves `/@keel/entry.ts`.

**Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (app frames only, max 5; personal data dropped, k.privacy), `csp` (k.security), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line.

**Rules.** E1551 `loader`/`action`/`commitStores` outside `*.server.ts` (any deployable) · E1554 loader data fails its output schema (dev diag; production 500) · E1555 production `assets` missing or entry-less · E1558 a live loader a non-`node` deployable serves.

**Conformance.**
- A GET with params that fail the params schema returns 404 and calls no loader.
- All loaders of a matched chain start before any of them resolves.
- A loader returning `err` with `keel.notFound` yields 404 and the route's `errorElement` HTML.
- A POST with invalid FormData or JSON (empty JSON too) returns 422, does not call the action, and lists the field errors.
- For a document request, `ok(href)` yields 303 with `Location: href`; `ok(null)` yields 303 to the request URL.
- An uncaught throw in production mode yields 500 whose body contains neither the thrown message nor a stack frame.
- The dev log stream emits exactly one `req` record per request; in json mode every line parses.
- A JSON or FormData action body over `maxBodyBytes` yields 413 `keel.payloadTooLarge` and does not call the action.
- A loader's `url` is the absolute URL of the request it serves.
- Overlapping actions on one factory's store each see only their own instance; the later save is 409 `keel.conflict`. A conflicting or `err` action and an unchanged store save nothing.
- `caller` is the hash of a server-signed cookie token, else of a fresh one set as a cookie on a write, else `""`.
- A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.
- An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a document GET renders `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403.
~~~

### k.topology (1,496 to 938)
- Declaration: "`topology({ <name>: { modules, adapter } })` (`@keel/server`), read statically." becomes "`topology({ <name>: { modules, adapter, storage?, shells? } })` (`@keel/server`), read statically; `storage`: k.deploy, `shells`: k.shell."
- Build, Deploy files, E1560 and the clauses "`node dist/<name>/server.mjs` of a `keel build` fixture ..." and "With `node` deployables `x`, `y` and a `client` one ..." move verbatim to k.deploy.

~~~md
# k.topology: Deployables
status: proposed

**Declaration.** `topology.ts` default-exports `topology({ <name>: { modules, adapter, storage?, shells? } })` (`@keel/server`), read statically; `storage`: k.deploy, `shells`: k.shell. Adapters: `node` (Hono; serves the resume entry), `static` (prerendered HTML), `client` (loaders, actions in the browser; entry `mount(App, el)`, real `ctx`). Each module, app or stdlib, is in one deployable. A module's routes, actions, live loaders and runners run where its deployable does and no other file names a deployable, so moving modules between deployables (split or merge) edits `topology.ts` alone.

**Route table.** A deployable serves its modules' routes: the generated entry merges each module's `routes` (`modules/<id>/routes.ts`) into `createApp({ routes })`. A path has one deployable (E1559).

**Runners.** A module's background work is the `runners` export of `modules/<id>/runners.server.ts`: `Runner`s `{ run(ctx, signal): Promise<void> }` that stdlib packages build (std.jobs, std.schedules). `createApp({ runners: { [moduleId]: Runner[] } })` calls each `run` of the served deployable's modules once, after startup, with the app's `ctx`. A `run` that rejects before `signal` aborts is a `diag` on the log and runs again 1,000 ms later on `ctx.clock`. `app.close()` aborts each runner's `signal` and open event stream and resolves when every `run` has settled.

**Calls and peers.** A module calls another's routes through `service({ module })` (k.services), encoded and decoded alike in every topology: a split adds latency and `api.network`/`api.timeout` outcomes, never another value. `createApp({ peers: { [deployable]: URL | ServerApp } })` names the other `node` deployables: URLs in production, apps in one process. A `service({ module })` request is answered in process when its module is here or in an in-process peer, else by the peer's URL. A request for a path a peer serves (by `routes.json` in `artifacts`) is forwarded to it: method, path, search, headers but `host`, body; its response is returned unchanged; one carrying `x-keel-forwarded` is not forwarded again.

**Local topology.** `keel dev` serves every deployable in one process on one origin: Vite serves `client` and `static` entries with HMR; each `node` deployable runs its dev `createApp` (real `ctx`, storage in `.keel-dev/`) and runners, the others its in-process peers, and serves its paths.

**Rules.** E1552 a topology module unknown or in two deployables · E1553 `static` deployable route with params or actions · E1559 one path in two deployables (names both routes).

**Conformance.**
- Fixture modules `a` (its loader calls `service({ module: 'b' })`) and `b` (a runner), served in one process as `{ one: [a, b] }` and as `{ x: [a], y: [b] }` under sim ctxs of one seed: a generated request script through `one` and through `x` gets equal statuses, bodies and final store states.
- `x` answers a path of `b` with `y`'s status, headers and body; one carrying `x-keel-forwarded` is not forwarded.
- With `a` and `b` in one deployable a `service({ module: 'b' })` call makes no `ctx.net.fetch`; with `y` at `http://y.test` it makes one, to that URL.
- `createApp({ runners })` runs each runner of the served deployable once, none of another; `close()` aborts their signals and resolves once each `run` settles; a rejected `run` runs again 1,000 ms later on the sim clock.
- Two routes with path `/p` in modules of different deployables are one E1559.
- With `origin` `https://a.example`, a POST with that `Origin` to another host passes the same-site check, and the caller cookie is `__Host-keel-caller`.
- `keel dev` answers a `client` page and a path of each `node` deployable from one process on one origin.
~~~

### k.compat (889 to 1,125)
- Surface: after "`output` and `errors`" add the stores sentence; a Stored data paragraph; Rules gain E1563 and W1564; one clause appended.

~~~md
# k.compat: Surface compatibility
status: proposed

**Purpose.** Deployables ship at different times, so a module's routes must keep accepting what its callers in other deployables send, and keep answering what they decode. `keel check` proves both from one artifact.

**Surface.** `keel build` writes `.keel/surface.json`, a k.compiler artifact (E1005): for each route of the app its `module`, `path`, `params`, `search`, its GET answer (`{ id, results }` of its chain's loader `output`s, k.server) and, per action method, its `input` and answer (`Result` of `Href | null`); for each `service({ module })` call its calling module, `module`, and each endpoint's method, `path`, `params`, `query`, `body`, `output` and `errors`; for each store a `stores` factory creates, its `id`, state schema and each transaction's payload schema (the build runs each factory once on a sim ctx). Schemas are JSON Schema, as in `routes.json`. To read them, the build evaluates `routes.ts` (k.compiler) and each file whose `endpoints` a `service({ module })` names.

**Accepts.** Schema `A` accepts `B` when every value `B` admits parses with `A`, decided on the schema kinds: an object accepts one whose required fields include every field it requires, whose fields it accepts field by field, and, when it is closed, one that is closed too with no other field; a literal or enum one whose values it holds; a number or string one whose bounds lie inside its own; an array one whose items it accepts; a union one whose every member some member accepts; a nullable or optional one when it accepts the inner schema; a format type one of its name; `s.json()` accepts any.

**Endpoints.** An endpoint of `service({ module: m })` matches the route of `m` with its `path` and method (GET: the loader; others: `routes.actions`). The route's `params`, `search` and `input` must accept the endpoint's `params`, `query` and `body`, and the endpoint's `output` and `errors` must accept the route's answer (E1561).

**Base.** `keel check --base <file>` reads another `surface.json`, the one of the deployed code (the generated CI takes the base branch's). For each base endpoint whose calling module and `m` are in different deployables now, the current route must accept the base endpoint's request, and the base endpoint's `output` must accept the current answer (E1562). Modules in one deployable ship together and are not compared. Without `--base`, no E1562.

**Stored data.** Stored snapshots outlive deploys (k.persist), so with `--base`, for each store in both surfaces, whatever its deployable: the current state schema must accept the base one (E1563), and each base transaction should still exist with a payload schema accepting the base one, since stored logs holding it fold at their next restore (W1564).

**Rules.** E1561 an endpoint of `service({ module })` that no route of that module at its method and path accepts, or whose `output` or `errors` refuse the route's answer, at the endpoint, naming the first refused path; no fix · E1562 a route change that a base endpoint in another deployable refuses, at the route's schema, naming the endpoint; fix when the change is one added required object field: make it optional · E1563 a state schema change a base store's stored states fail, naming the store and the first refused path; the same fix · W1564 a base transaction removed or its payload narrowed, naming it; no fix.

**Conformance.**
- For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.
- An endpoint whose `body` lacks a field the route's `input` requires is one E1561; the same endpoint with the route's own schema has none.
- With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none.
- Removing an output field a base endpoint requires is one E1562 with no fix; adding a field to an open output object is none.
- `keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005.
- A `service({ module: 'b' })` endpoint in module `a` reports E1152 without `b` in `deps` and E1157 for a route not in `b`'s `public.routes`.
- With a base where store `s` has state `{ a }`, adding a required field `b` is one E1563 at `b` whose fix leaves none, adding an optional one is none, removing a transaction of `s` is one W1564, and without `--base` there is neither.
~~~

### k.ledger (1,428 to 1,466)
- `proven`: gains "or a passing `prove` (k.prove), whose evidence lists the Z3 version"; one clause appended.

~~~md
# k.ledger: Ledger and evidence
status: proposed

**Ledger.** `keel ledger` emits one NDJSON record `{ kind: 'ledger', item, rung, evidence }` per public export (`<file>#<name>`), per spec clause (`k.router#3`, the 1-based Conformance sentence) and per route and WCAG criterion (`a11y:<routeId>#1.4.3`, k.a11y). A conformance test in any package names its clause in a header comment, `// Spec: k.router, clause "<sentence>"`, quoted verbatim (backticks, quote style, spacing, case and the final period aside; it may wrap onto the next `//` lines). `rung` is the highest held:
- `example`: a passing test references the item.
- `probabilistic`: a passing seeded property with >= 100 runs; evidence lists runs and seed.
- `exhaustive`: a passing `explore` (k.model) given `from`, `payloads` or `depth`; evidence lists `depth` when it is a literal.
- `proven`: a passing type-level test (its body asserts with `expectTypeOf` or `assertType`, which the package's `check` type-checks) a passing closed-form `explore` (k.model), which passes only when the store's whole space closed, or a passing `prove` (k.prove), whose evidence lists the Z3 version; nothing else may claim it.
- `monitored`: production only, read from an app's `.keel/monitored.json`; never emitted by the kernel. No evidence: `none`.

**Evidence from tests.** A test references an item when its body, or a helper it calls in its own file or a relative import, names it. Property runs are `properties`, `simulate` (k.sim) and fast-check's `assert` and `check`, with `runs` and `seed` read from literal options or imported constants (`properties` and `simulate` default to 100 and 1337); an unresolved value leaves the run `example`. An `explore` call is closed-form when its options object is absent or names none of `from`, `payloads` and `depth`; options the ledger cannot read count as given.

**Production evidence.** An app's `.keel/monitored.json` is `{ v: 1, origin, from, to, tx: { [name]: runs } }`, written by a stdlib monitor (std.monitor). An app export holds `monitored` when its file holds, as a string literal, the name of a transaction with `runs` >= 1, or that name's longest dotted prefix that any file holds (a chart id); evidence lists the runs and `to`. A file failing this shape is E1711 and adds nothing.

**Mutation.** Stryker (`pnpm mutate`, run alone and never inside `pnpm check`) writes `packages/<pkg>/reports/mutation/mutation.json`. `keel ledger` turns each report into one claim per mutated file, `{ file, sha, killed, survived, noCoverage, score }`: `sha` is the sha256 of the source the report holds for that file, and `score` is detected over detected plus undetected (Stryker's formula; timeouts count as detected). A claim is fresh while the file's current source has that `sha`. Each package's score is computed over its fresh claims, with the report's `thresholds.break` as its threshold. `keel ledger` emits one `{ kind: 'ledger.mutation', file, score, survived, fresh }` per claim; compact `packages/store/src/tx.ts 91.2% 3 survived`. `ledger` and `ledger.mutation` are kernel record kinds (k.cli).

**File.** `keel ledger --write <file>` writes `{ version, unsafe, rungs, mutation, exports, clauses }`: `rungs` counts, for each rung, the items holding any evidence on it; `mutation` holds each package's `{ score, threshold }` and the claims, a report on disk replacing the claims of the files it covers and other claims kept. The summary carries the `rungs` counts and the count of `stale` claims.

**Diff.** `keel ledger --diff` compares with the committed ledger, reading reports on disk as `--write` does, and checks every `conformance-covered` or `frozen` section's clauses.

**Rules.** E1706 ledger rung lower than committed, or unsafe count higher · E1707 `keel ledger --diff`: a `conformance-covered` or `frozen` section has a clause at `none`, or no clause list · W1706 conformance header `// Clause:` (not counted; fix rewrites it to `// Spec:`) · E1711 `.keel/monitored.json` fails its shape · E1712 `--diff` without `--scope`: a rung the committed `rungs` counts above 0 is held by no item · E1713 `--diff`: a package's score over fresh claims is below its threshold, or its threshold is below the committed one · W1714 a mutation claim is stale (its file changed since the run).

**Conformance.**
- An export tested only by examples is `example`; adding a passing 100-run property makes it `probabilistic`.
- Lowering an item's rung below the committed ledger makes `keel ledger --diff` report E1706.
- A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line.
- A passing `simulate` with `runs: 100` and a literal seed makes the exports its scenario names `probabilistic`.
- A passing `explore` with `from`, `payloads` or `depth` makes the transactions it names `exhaustive`; one with none of them makes them `proven`; one whose options are an imported variable gives `exhaustive`.
- A `.keel/monitored.json` naming `todos.editor.save` with runs 3 gives `monitored` evidence to the export whose file holds `'todos.editor'` and to no other; a file failing its shape is E1711.
- From a report whose sources match the tree, `keel ledger --write` stores one claim per mutated file with Stryker's counts, and the package score over them; after one file changes, its claim is stale (W1714) and the package score omits it.
- With a committed ledger whose `rungs.monitored` is 1, removing `.keel/monitored.json` makes `--diff` report E1712.
- A report whose package score is below its `thresholds.break`, or whose `thresholds.break` is below the committed threshold, makes `--diff` report E1713.
- A passing test whose body asserts with `expectTypeOf` makes the exports it names `proven`.
- A passing test whose body calls `prove` makes the transactions it names `proven`.
~~~

### std.jobs (1,028 to 1,111)
- Run: the lease ends `timeoutMs` plus 1,000 ms after it starts; every queue change is one `commit`. Restart: an ended lease is free; aborted jobs' leases are freed. One clause appended.

~~~md
# std.jobs: Background jobs
status: proposed

**Extension points.** Module manifest (k.module): `@keel/std-jobs` is stdlib module `jobs`; a module that defines jobs lists it in `deps` and `clock`, `random` and `storage` in `capabilities`, and is placed in a `node` deployable. Inspector hooks (k.cli): section `jobs.queue`. Check rule registry (k.check): `@keel/std-jobs/tools` registers E2501-E2504.

**API** (`@keel/std-jobs`; every export is used from `*.server.ts`).
```ts
export const sendReceipt = job({ input: Receipt, attempts: 5 }, async (input, ctx, signal) => ok(null))  // sendReceipt.server.ts
export const jobs = queue({ 'orders.sendReceipt': sendReceipt })   // modules/orders/jobs.server.ts
export const runners = [jobs]                                       // modules/orders/runners.server.ts (k.topology)
const r = await jobs.enqueue(ctx, 'orders.sendReceipt', { orderId }, { key: orderId })  // Result<Id<'Job'>, KeelError>
```
- `job({ input, attempts = 3, timeoutMs = 60000 }, fn)`: `fn(input, ctx, signal)` returns `Promise<Result<null, KeelError>>`. `input` holds no `s.secret` (E2503): a job's input is stored.
- `queue(table)` is a `Runner` with `enqueue(ctx, id, input, { delayMs?, key? })`. `enqueue` parses `input` with the job's schema (fail: `err` `keel.fields`), stores `{ id: random.id('Job'), job, input, at: now + delayMs, attempt: 0 }` under `ctx.storage` key `std.jobs.<module>`, and returns `ok(id)`. A `key` equal to a pending job's, or to one of the last 1,000 finished in that queue, returns that job's id and stores nothing.
- **Run.** The runner starts due jobs in `at`, then `id` order, at most `concurrency` at once (module `std` config `{ concurrency }`, 1 to 16, default 1). Before `fn` it stores a lease that ends `timeoutMs` plus 1,000 ms later. Every change to the queue is one `commit` (k.persist) against the value it read, retried on `false`, so processes sharing a storage driver never lease one job twice. `ok` removes the job. `err`, a throw, or no result within `timeoutMs` (then `signal` aborts) counts an attempt: the job waits `min(1000 · 2^(attempt-1), 3600000)` ms on `ctx.clock`, and after `attempts` moves to the newest 100 `failed`, with its error code and no input. Between jobs it waits on `ctx.clock.after` for the next `at` or an `enqueue`.
- **Restart.** Everything above lives in `ctx.storage`, so it survives a restart. A lease past its end is free, so a job leased by a stopped process runs again, counted as an attempt: a job runs at least once, so `fn` must be idempotent. When the runner's `signal` aborts no job starts, and running ones get their `signal` aborted and their leases freed.
- **Inspect.** `jobs.queue` is, per module, `{ pending, running, failed: { id, job, code, at }[] }`: counts and codes, never an input.
- A job runs only in its module's deployable. Another module starts one by calling an action of the owning module (k.services), never by importing its queue.

**Rules.** E2501 a `queue` key not prefixed by its module id, or a `queue` outside `modules/<id>/jobs.server.ts` (fix prefixes the key) · E2502 `jobs` in `public.exports` (fix removes it) · E2503 a job `input` schema holding `s.secret` (no fix; `queue` also throws it) · E2504 a module with `jobs.server.ts` whose `runners` lacks `jobs` (fix adds it), or placed in a non-`node` deployable.

**Conformance.**
- Under sim, a job enqueued with `delayMs: 500` runs when the clock reaches 500, not before, with the parsed input; `ok` removes it.
- A job returning `err` twice then `ok` with `attempts: 3` runs at 0, 1,000 and 3,000 ms; with `attempts: 2` it ends in `failed` with its code and no input.
- Two `enqueue`s with one `key` return one id and run once, also when the second comes after the first finished.
- After `close()` while `fn` is pending, a new `createApp` on the same ctx runs that job again; a job finished before `close()` never runs again; a pending one runs after the new start.
- With `concurrency: 2` and five due jobs, at most two `fn` calls are pending at any time.
- An `fn` not settled after `timeoutMs` sees its `signal` aborted, and the run counts as an attempt.
- The `jobs.queue` section holds counts and failures and no input value.
- E2501-E2504 each fire on a fixture and not on its clean twin; a `queue` whose input holds `s.secret` throws E2503.
- Two `createApp`s on one sim ctx, each running the queue with five due jobs: each job's `fn` runs once.
~~~

### std.statecharts (1,298 after RFC 0084, to 1,348)
- Compiles to: the chart exposes `next`; one clause appended. Applied to RFC 0084's text, whose Instances paragraph is unchanged.

~~~md
# std.statecharts: State charts
status: proposed

**Extension points.** Check rule registry: E2751-E2755 through `@keel/std-statecharts/tools`. A chart compiles to a k.store store and one transaction per event, so it needs no capability and no kernel change.

**Declare.** In a client-safe file whose name is the export:
```ts
export const editorChart = chart('todos.editor', {
  data: EditorData, start: { attempts: 0 },
  events: { edit: s.object({}), save: s.object({}), saved: s.object({}), refused: s.object({}), failed: s.object({}), mine: s.object({}), theirs: s.object({}), cancel: s.object({}) },
  guards: { canRetry: (d) => d.attempts < 3 },
  actions: { count: (d) => ({ attempts: d.attempts + 1 }), reset: () => ({ attempts: 0 }) },
  initial: 'viewing',
  states: {
    viewing: { on: { edit: 'editing' } },
    editing: { on: { save: { to: 'saving', do: 'count' }, cancel: 'viewing' } },
    saving: { on: { saved: { to: 'viewing', do: 'reset' }, refused: 'conflict', failed: [{ to: 'saving', guard: 'canRetry', do: 'count' }, { to: 'gaveUp' }] } },
    conflict: { on: { mine: { to: 'saving', guard: 'canRetry', do: 'count' }, theirs: { to: 'viewing', do: 'reset' } } },
    gaveUp: { final: true },
  },
})
```
`chart(id, { data, start, events, guards?, actions?, initial, states })`: `id` is the store id, prefixed by the declaring module (E1155). `data` is the schema of the chart's own values and `start` their first value; `events` maps each event to its payload schema. A state is `{ on?, final? }`; `on` maps an event to a target: a state name, `{ to?, guard?, do? }` (`to` absent: stay), or a list of those, tried in order. `guards` are pure predicates `(data, payload) => boolean` and `actions` pure updates `(data, payload) => data`, named by `guard` and `do`.

**Compiles to.** The store `id`, state schema `s.object({ state: s.enum(<state names>), data }, { closed: true })`, initial `{ state: initial, data: start }`; and per event the transaction `<id>.<event>` with that event's payload schema. Its function takes the first target of the current state's `on[event]` whose `guard` holds for `(data, payload)`, applies `do` to `data` and moves to `to`; with no such target the state is unchanged. The chart exposes `store`, `events` (each event's `Transaction`), `states`, `initial`, `enabled(state, event, payload)`, true when a target applies, and `next({ state, data }, event, payload)`, the `{ state, data }` that event's transaction gives. Writes go through `tx(editorChart.events.save, {})`, under `uses` (k.store) as any transaction.

**Instances.** `instance(chart, key)` compiles the same declaration again in the calling scope: the store `<id>:<key>` with the same schema and initial, and per event the transaction `<id>:<key>.<event>` with the same function; it returns `{ store, events, enabled }` and is disposed with the scope. `key` is 1 to 64 characters of `[A-Za-z0-9._-]`, else it throws; a live duplicate throws (k.store). `explore` over the chart covers every instance: each runs the chart's function on the chart's schemas.

**Checked.** `keel check` analyzes the declaration as written; `chart` repeats E2751, E2753 and E2754 as throws. Reachability treats every guard as possibly true, so a state E2752 names is unreachable on every run. Guarded reachability and stuck states are k.model's: `coverage(chart, explore(Object.values(chart.events)))` returns `{ unreached, dead }`, the declared states no explored state holds and the non-final states some `terminal` state holds.

**Rules.** E2751 `initial` or a `to` naming no state (fix: the nearest state name) · E2752 a state unreachable from `initial` through `on` targets · E2753 a non-final state with no target to another state (fix: add `final: true`) · E2754 a final state with `on`, an `on` event missing from `events`, or a `guard` or `do` naming no entry · E2755 a `chart` whose `initial`, `states`, `on` keys or targets are not literals (the checker cannot prove it).

**Conformance.**
- The compiled store's schema parses `{ state: initial, data: start }` and refuses a state name outside `states`; each event's transaction is named `<id>.<event>` and its `schema` is that event's payload schema.
- `tx` of an event moves to the first target whose guard holds and applies its `do`; with no applicable target the state and `data` are unchanged.
- `enabled(state, event, payload)` is true exactly when `tx` of that event changes the state's name or applies a `do`.
- Under `explore`'s closed form, a chart with finite `data` and payloads returns `complete: true`, and `coverage` lists a state whose only entry is guarded by an unsatisfiable guard in `unreached`.
- A state whose every exit is guarded false from some reachable `data` appears in `dead`.
- `keel check` reports E2751 to E2755 on fixtures and nothing on their clean twins; E2751 carries a fix to the nearest name and E2753 one adding `final: true`.
- `chart` throws E2751, E2753 and E2754 for those fixtures.
- An event's transaction passes `properties` for a chart whose guards and actions are pure.
- `instance(c, 'a')` and `instance(c, 'b')` in one scope are stores `<id>:a` and `<id>:b`; a `tx` on one leaves the other unchanged; disposing the scope drops both from `stores()`; `instance(c, 'a b')` throws.
- For generated `{ state, data }` and payloads, `next` equals the state `tx` of that event gives from it.
~~~

### spec/kernel/k.persist.md (new, 1,062)
~~~md
# k.persist: Storage and durable state
status: proposed

**Storage.** `ctx.storage` holds string values by string key:
- `get(key)`: the value, `null` when absent. `set(key, value)` stores it.
- `read(keys)`: the values of several keys, `null` for an absent one, in the order asked, as one cut: no `commit` lands between two of them.
- `commit(writes)`: each write is `{ key, expect, value? }`, `expect` a value or `null` (absent). When every key holds its `expect`, each `value` is stored and it resolves `true`; otherwise nothing is stored and it resolves `false`. A write without `value` is a condition only. One key twice throws E1606.

Real: the platform's `localStorage` (on Node, the file `--localstorage-file` names; one process). Sim: in memory per ctx; under a schedule (k.sim) a `read` or `commit` is one storage call, and a failed `commit` stores nothing. Two `createApp`s on one sim ctx behave as two processes sharing one storage. Shell: k.shell.

**Drivers.** `createCtx({ mode, drivers: { storage?, net? } })` gives a `real` or `shell` ctx the object as that capability, which keeps its contract (`storage` above; `net` k.ctx and k.sync). On a `sim` ctx `drivers` throws E1605: simulation stays the kernel's, so runs replay. Generated entries pass drivers (k.deploy, k.shell); app code reaches them only through `ctx`.

**Server saves.** k.server's state rules hold for every process sharing one driver:
- A request restores a factory's stores from one `read` of their keys (`keel.store.<id>`).
- An action's `ok` saves in one `commit`: each changed store's `snapshot({ meta: true })` JSON, `expect` the value it was restored from, and each opened unchanged key as a condition. `false` is 409 `keel.conflict` with nothing saved, so the read-set rule and a save of several stores hold across processes.
- `commitStores(ctx, factory, fn)` (`@keel/server`, `*.server.ts` only, E1551) is that path outside a request, for runners and jobs: one `read`, `fn(S)` returning a `Result`, and on `ok` a `commit` as an action makes, then `save` events (k.sync). On `false` it runs `fn` again on a fresh read, at most 3 runs in all, then returns `err` `keel.conflict`; `err` or a throw saves nothing. `fn` may run more than once, so it calls transactions and no other effect. There is no `caller`.

**Older snapshots.** A stored snapshot outlives the code that wrote it. `restore` of a snapshot whose state parses but whose log names a transaction the store no longer declares, or holds a payload its schema refuses, keeps `state` and `head`, takes `state` as `initial`, and keeps no entry. A state the schema refuses stays `restore`'s `err`. Before a deploy, k.compat reports both (E1563, W1564).

**Rules.** E1605 `drivers` on a `sim` ctx (throws) · E1606 one key twice in a `commit` (throws) · E1551 also names `commitStores` outside `*.server.ts`.

**Conformance.**
- `read(keys)` returns each key's value in the order asked, `null` for an absent key.
- `commit` stores every `value` and resolves `true` when each `expect` matches; with one `expect` stale it stores nothing and resolves `false`; a write without `value` is checked and not stored.
- For generated interleavings of `commit`s from two apps on one sim ctx, the stored values equal a serial order of the commits that resolved `true`, and a `read` never returns a value from between two writes of one `commit`.
- `createCtx({ mode: 'sim', drivers: {} })` throws E1605; a `commit` naming one key twice throws E1606.
- `createCtx({ mode: 'real', drivers: { storage } })` returns `storage` as `ctx.storage`.
- Two `createApp`s on one sim ctx, overlapping actions that read one store and save another: the later save is 409 and the stored values are the earlier one's.
- An action saving two stores whose `commit` resolves `false` stores neither.
- `commitStores` whose `commit` is refused twice then accepted runs `fn` three times and saves once; refused three times it returns `keel.conflict` and saves nothing.
- `commitStores` reports one `save` event per changed store and none when nothing changed.
- `restore` of a snapshot whose log names an undeclared transaction returns `ok`, keeps `state` and `head()`, and leaves `log()` empty and `snapshot().initial` equal to `state`.
~~~

### spec/kernel/k.deploy.md (new, 979)
~~~md
# k.deploy: Builds, storage and deploy files
status: proposed

**Build.** `keel build` writes per `node` deployable `dist/<name>/`: the client build (k.server), `routes.json`, `std.json`, and `server.mjs`, the generated entry with every dependency bundled. `node server.mjs` parses `process.env` with `DeployEnv`: `PORT` (default 8080), `KEEL_ORIGIN` (`createApp({ origin })`, the public origin, which replaces the request's in `url`, the same-site check and `Secure`), `KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees), `KEEL_PEER_<NAME>` for each other `node` deployable, and `KEEL_DATABASE_URL` (Storage). A failure prints one E1560 naming the key, never a value, and exits 1. Then it opens storage, serves `createApp` (production, real `ctx`, its routes, runners and peers) and on SIGTERM or SIGINT stops listening, awaits `close()` and exits.

**Storage.** A `node` deployable's `storage` in `topology.ts` decides its `ctx.storage`, the only state that survives a restart:
- `'file'` (default): the file `--localstorage-file` names; one process.
- `'sqlite'`: a SQLite file, `KEEL_DATABASE_URL` a `file:` URL (default `file:/data/keel.sqlite`); processes on one host may share it.
- `'postgres'`: `KEEL_DATABASE_URL` a `postgres:` or `postgresql:` URL (required); replicas share it.
`'sqlite'` and `'postgres'` are drivers (k.persist) of `@keel/std-db` (std.db), which the app lists in `dependencies` (E1572); the generated entry imports the one named and `start` opens it before listening (a failure: std.db's E2152 or E2153, exit 1). The URL is a secret: no log line, diagnostic or generated file holds it.

**Deploy files.** Derived from `topology.ts` by one generator (`@keel/scaffold`), written by `keel build` and by scaffold operations that change modules or deployables; read-only (E1005, fix: the regenerated file).
- `deploy/<name>/Dockerfile` per `node` deployable: `node:22-slim` by digest, `dist/<name>/` only, user `node`, port 8080; `'file'`: volume `/data`, `--localstorage-file=/data/storage`; `'sqlite'`: volume `/data`, no storage flag; `'postgres'`: no volume.
- `deploy/compose.yaml`: a service per `node` deployable and a volume per one with a volume, `KEEL_PEER_<NAME>` set to peers' service URLs, other `DeployEnv` keys (`KEEL_DATABASE_URL` too) from the environment.
- `.github/workflows/ci.yml` (outside the Keel repo): a job per deployable, run when its modules or shared config change: install, `keel check --base` the base branch's surface (k.compat), `keel test`, `keel build`, an unpushed image build per `node` deployable; shell jobs: k.shell.
- Shell files: k.shell.
`DeployEnv` values are set where the image runs, never in a generated file.

**Rules.** E1560 the production environment fails `DeployEnv` (at startup) · E1572 a deployable's `storage` or `shells` needs a package the app's `dependencies` lack (fix adds it).

**Conformance.**
- `node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value.
- With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.
- With `storage: 'postgres'`, `server.mjs` with `KEEL_DATABASE_URL` unset, or set to a `file:` URL, exits 1 with one E1560 naming `KEEL_DATABASE_URL` and no value.
- The Dockerfile of a `'sqlite'` deployable declares `/data` and runs `server.mjs` without `--localstorage-file`; of a `'postgres'` one declares no volume; `compose.yaml` passes `KEEL_DATABASE_URL` from the environment and holds no URL.
- `storage: 'sqlite'` without `@keel/std-db` in `dependencies` is one E1572 whose fix adds it; with it, none.
~~~

### spec/kernel/k.shell.md (new, 1,187)
~~~md
# k.shell: Native shells
status: proposed

**Declaration.** A `client` deployable may name the native shells that package it as an app: `shells: { capacitor?: { id, name }, tauri?: { id, name } }` in `topology.ts`. `id` is a reverse-DNS app id (`dev.keel.golden1`), `name` the title people see; the version is the app's `package.json` `version`. Capacitor makes the Android and iOS apps, Tauri the Linux, macOS and Windows apps. Each needs its package in `dependencies` (`@keel/std-capacitor`, `@keel/std-tauri`, std.shells; E1572). `shells` on another adapter, or an `id` that is not reverse-DNS, is E1573.

**Shell ctx.** A shell build's entry is the `client` entry with `createCtx({ mode: 'shell', drivers })`, the package's `storage` and `net` drivers (k.persist). The page loads from the shell's own origin (`capacitor://localhost`, `https://localhost`, `tauri://localhost`), so the drivers keep this contract:
- `net.fetch`: a request to the page's origin (a relative URL included) goes to the build's `KEEL_ORIGIN`, same method, path, search, headers and body, through the shell's native HTTP client; another origin's request goes as given. Cookies, the caller cookie included (k.security), stay in the shell's cookie store and go only to their origin. A failure rejects with a `TypeError`. `online()` and `net` events: as real.
- `storage`: the shell's native store, kept across app restarts, written before `set` or a `true` `commit` resolves.
- `clock`, `random` and registered capabilities: as real, unless a capability's `shell` factory differs.
So `modules/` run unchanged in a browser and in a shell.

**Files.** Derived from `topology.ts` by the deploy generator (k.deploy); read-only (E1005):
- `deploy/<name>/capacitor/capacitor.config.json`: `appId`, `appName`, `webDir` `www`.
- `deploy/<name>/tauri/`: `tauri.conf.json` (`identifier`, `productName`, `version`, `build.frontendDist` `www`, one window titled `name`, `app.security.csp` the deployable's policy (k.security) with `ipc: http://ipc.localhost` added to `connect-src`), `Cargo.toml` (exact versions of `tauri`, `tauri-build`, `tauri-plugin-store`, `tauri-plugin-http`), `build.rs`, `src/main.rs`, `src/lib.rs`, `capabilities/default.json`. Cargo writes `Cargo.lock` there on the first build; it is committed and not generated.

**Build.** `keel build --target capacitor --platform android|ios` or `keel build --target tauri` [`--release`] builds each `client` deployable declaring that shell:
1. `KEEL_ORIGIN` from the environment: unset, or not `https:` outside `localhost`, is E1574.
2. The toolchain, before any work: JDK 21 and the Android SDK; Xcode 26; Rust 1.95 and, on Linux, WebKitGTK 4.1. A missing or older one is E1575 naming it and the version needed.
3. The shell entry and web build into `dist/<name>/<shell>/www/`, beside the shell files and, for Tauri, the http permission for `KEEL_ORIGIN`. Capacitor's `www/index.html` carries the policy in a `<meta http-equiv>`, without the directives a meta tag ignores.
4. The shell's tools: `cap sync`, then Gradle `assembleDebug` or `xcodebuild` for the simulator without signing; `tauri build --debug --no-bundle`. `--release` builds unsigned release artifacts.
The trailer names the artifact: `ok build web tauri dist/web/tauri/target/debug/golden-1`. Signing and store upload are not Keel's.

**CI.** The generated workflow gains a job per shell on its deployable's paths: Tauri on Ubuntu (WebKitGTK packages), Capacitor Android on Ubuntu (JDK 21), each uploading its artifact; Capacitor iOS on macOS, on manual dispatch only.

**Rules.** E1573 `shells` on a deployable that is not `client`, or an `id` that is not reverse-DNS · E1574 a shell build without a valid `KEEL_ORIGIN` (names the key) · E1575 a shell build's tool missing or too old (names it and the version needed).

**Conformance.**
- With `web` (`client`) declaring `tauri`, `keel build` writes the `deploy/web/tauri/` files and no Capacitor file; a changed byte is E1005 whose fix restores it; removing `tauri` from `topology.ts` removes them.
- `tauri.conf.json` holds the declared `identifier` and `productName`, the `package.json` `version`, and the deployable's policy with `ipc: http://ipc.localhost` in `connect-src`.
- `shells` on a `node` deployable is one E1573; `id: 'golden'` is one E1573.
- `keel build --target tauri` with `KEEL_ORIGIN` unset prints one E1574 naming it and builds nothing; with `http://localhost:8080` it proceeds.
- With no `cargo` on `PATH`, `keel build --target tauri` prints one E1575 naming `cargo` and Rust 1.95, exits 1 and writes nothing under `dist/web/tauri/`.
- The `www` entry a shell build writes creates its ctx with `mode: 'shell'` and the package's drivers; the plain `client` entry is unchanged.
~~~

### spec/kernel/k.prove.md (new, 929)
~~~md
# k.prove: Proving invariants
status: proposed

**Purpose.** `explore` (k.model) proves a store's invariants by enumerating its states, so it needs a finite space. `prove` proves them for every state and payload the schemas allow, finite or not, by induction with an SMT solver, for functions written in the fragment below.

**API** (`@keel/testing/prove`, Node).
```ts
test('board invariants are inductive', () => prove([addList(b), addTodo(b), toggleTodo(b), editTodo(b)]))
```
`prove(transactions, { rlimit? })` takes transactions of one store. It resolves when the store's `initial` passes `check` and, for each transaction `t`, every state `s` that parses with the store's schema and satisfies every `invariant` of the store, with every payload `p` that parses with `t.schema`, yields a state that parses and satisfies every invariant. So every state reachable through those transactions, undo included, satisfies the invariants: the `proven` rung (k.ledger). It rejects with:
- E1715 a function outside the fragment, naming the construct and its offset in the function's source; there is no claim, and `explore` remains.
- E1716 a counterexample: the state (or `initial`) and the payload, as JSON on the next line. The state may be unreachable; then the invariant is true but not inductive: strengthen it, or `explore`.
- E1717 no verdict within `rlimit` (default 10,000,000 Z3 resource units, a count rather than time, so a verdict repeats).
- E1718 the optional peer dependency `z3-solver` is not installed (fix adds it to `devDependencies`).

**Fragment.** Each transaction and invariant function is read from its source (`fn.toString()`, parsed with oxc) and translated whole:
- Parameters, `const`, `return`, `if`/`else`, `?:`, `&&`, `||`, `!`, `===`, `!==`, `<`, `<=`, `>`, `>=`, `+` and `-`, `*` by a numeric literal, literals.
- Objects: literals, spread, property reads; `s.record` maps read as `m[k]` and written as `{ ...m, [k]: v }`.
- Arrays: literals with spread, `.length`, index reads, and `.map`, `.some`, `.every`, `.find` with an arrow of the fragment; `new Set(a.map(f))` read only by `.has(x)` and by `.size === a.length` (the values of `f` over `a` are distinct).
Anything else is E1715: calls to other functions, identifiers other than parameters and bindings, loops, reassignment.

**Sorts** come from the schemas: booleans; literals and enums as finite sorts; `s.int` as integers within its bounds and ±(2^53 − 1), every integer result included; a non-integer `s.number` compared and copied only; strings and ids compared for equality; objects as records of their declared fields; `optional` and `nullable` as an option; arrays as a length and an index map; records as a key set and a map.

**Solver.** Z3 through `z3-solver` (MIT), loaded on first use, single-threaded, `smt.random_seed` 0. A verdict holds for the installed Z3 version, which the evidence records.

**Conformance.**
- A store `{ n: s.int({ min: 0 }) }` with invariant `n >= 0`, `inc` (`n + 1`) and `dec` (`n > 0 ? n - 1 : n`) proves; with `dec` as `n - 1` it rejects E1716 with state `{ n: 0 }`.
- A transaction calling an imported helper rejects E1715 naming the call.
- Appending `p` to an array under `!a.some(x => x.id === p.id)` proves `new Set(a.map(x => x.id)).size === a.length`; without the guard it rejects E1716 with a state holding `p.id`.
- An invariant true in every reachable state but not inductive rejects E1716 with a state no transaction reaches.
- A store whose `initial` breaks an invariant rejects E1716 with that state and no payload.
- Two runs give byte-equal verdicts and counterexamples.
- `rlimit: 1` rejects E1717 where the default proves.
- Without `z3-solver`, `prove` rejects E1718.
~~~

### spec/std/std.db.md (new, 947)
~~~md
# std.db: SQLite and Postgres storage
status: proposed

**Extension points.** Storage drivers (k.persist Drivers): `@keel/std-db/sqlite` and `@keel/std-db/postgres` export the drivers a `node` deployable's generated entry opens when `topology.ts` sets `storage` (k.deploy). Check rule registry: `@keel/std-db/tools` registers E2151. App code never imports the package (E2151): its state reaches the database only through stores and `ctx.storage`.

**API** (Node only; called by generated entries).
```ts
const storage = await sqlite(new URL('file:/data/keel.sqlite'))   // KeyValueStorage (k.persist)
const storage = await postgres(new URL(env.KEEL_DATABASE_URL))
```
- `sqlite(url)` uses `node:sqlite` (Node 22.13 or later): WAL journal, `synchronous=FULL`, `secure_delete=ON`, `busy_timeout` 5,000 ms; `read` runs in one read transaction, `commit` in `BEGIN IMMEDIATE`.
- `postgres(url)` uses `pg`, a pool of at most 10 connections, TLS as the URL's `sslmode` says; `read` is one `SELECT`; `commit` is one transaction that takes `pg_advisory_xact_lock` for each key in key order, compares, then writes.
- Both keep k.persist's contract and expose nothing else: no SQL, query builder or table.

**Layout.** Two tables: `keel_kv (key text primary key, value text not null)` and `keel_meta (name text primary key, value text not null)`, whose `layout` row is std.db's table version (1). Opening creates or upgrades them in one transaction; a newer `layout` is E2152 and the process exits 1. Other tables are left alone. App schemas never become columns: a store persists as its snapshot (k.persist), and k.compat checks schema changes against stored data (E1563, W1564).

**On disk.** Exactly what `ctx.storage` receives: each server store's `snapshot({ meta: true })` (state, `initial`, `head`, and the kept log with payloads, write keys and `caller` hashes), std.jobs queues, std.schedules marks and std.workflows stores. No secret arrives: `store()` refuses `s.secret` in state (E1303), a snapshot folds a secret payload, and job inputs refuse it (E2503). Personal data (`.pii`, k.privacy) is stored as the store holds it: the database is the app's own data, not a sink. std.db puts no value in a log line, a diagnostic or an error message; they name keys. A value removed from state leaves the database once its last log entry folds past `logLimit`; SQLite then overwrites the freed pages, and Postgres keeps dead row versions until vacuum. Encryption at rest is the volume's or the host's.

**Rules.** E2151 an app file imports `@keel/std-db` (no fix) · E2152 the database's `layout` is newer than the package's (at startup) · E2153 the database cannot be opened or refuses the connection, naming `KEEL_DATABASE_URL` and no part of its value (at startup).

**Conformance.**
- Each driver, on a temporary SQLite file and on Postgres (PGlite, and a Postgres 17 service in CI), passes k.persist's storage clauses.
- Two processes on one SQLite file, each serving `createApp` on its driver, with overlapping actions on one store: one saves, the other is 409, and the file holds the first's snapshot.
- A process killed with SIGKILL after an action's response restarts on the same database and serves the same stored snapshot byte for byte; its next commit's head is one higher.
- For generated sequences of commits from two connections, the stored values equal a serial order of the commits that resolved `true`.
- An empty database opens at layout 1; a database at layout 2 is E2152 and exit 1.
- A refused connection prints one E2153 naming `KEEL_DATABASE_URL` and no part of its value.
- An app file importing `@keel/std-db/sqlite` is E2151; the generated entry is not.
- After a value is overwritten, its entry folded and the driver closed, the SQLite file's bytes do not hold it.
~~~

### spec/std/std.workflows.md (new, 1,356)
~~~md
# std.workflows: Workflows
status: proposed

**Extension points.** Module manifest (k.module): `@keel/std-workflows` is stdlib module `workflows`; a module with workflows lists it, `@keel/std-jobs` and `@keel/std-statecharts` in `deps`, `clock`, `random` and `storage` in `capabilities`, and is placed in a `node` deployable. Inspector hooks: section `workflows.instances`. Check rule registry: `@keel/std-workflows/tools` registers E2351-E2354.

**API** (`*.server.ts`).
```ts
export const removal = workflow('api.removal', {                       // modules/api/removal.server.ts
  chart: removalChart,                                                  // std.statecharts; `data` is an instance's data
  steps: { purging: { run: purgeList, done: 'purged', failed: 'stuck', attempts: 3 } },
  waits: { hidden: { ms: 600_000, event: 'expired' } },
})
export const purgeList = async (data, ctx, { signal, key }) => ok({})  // purgeList.server.ts; ok value: the `done` payload
export const jobs = queue({ ...removal.jobs })                         // modules/api/jobs.server.ts (std.jobs)
export const runners = [jobs, flows(jobs, [removal])]                  // modules/api/runners.server.ts
tx(s.removal.start, { id: ctx.random.id('Flow'), data: { list } })    // in an action whose `stores` include `removal.stores`
tx(s.removal.events.undo, { id, payload: {} })
```
`workflow(id, { chart, steps?, waits?, keepMs = 86_400_000, limit = 1000, attempts = 3, timeoutMs = 60_000 })`. A step names a state, its `run`, the chart events for its `done` and `failed` (payload `{ code }`) and optional `attempts` and `timeoutMs`; a wait names a state, `ms` and an event with payload `{}`.

**Store.** `removal.stores(ctx)` creates the store `id`, state `{ instances: { [Id<'Flow'>]: { state, data, entered, attempt } } }`, and its transactions: `start` `{ id, data }` (an existing id: unchanged; past `limit` instances not final: `store.invariant`), one per chart event `{ id, payload }` (the instance moves by `chart.next`; when its state name changes `entered` rises by one and `attempt` returns to 0; an unknown or final instance: unchanged), `attempt` `{ id, entered }` and `forget` `{ id }` (removes a final instance). Each changes one instance, so an invariant of the chart's `{ state, data }` that a closed-form `explore` of the chart proves holds for every instance.

**Run.** `flows(queue, workflows)` is a `Runner` (k.topology). At start, after each `save` of a workflow store (k.sync) and every 60,000 ms of `ctx.clock`, it reads each store and enqueues, with std.jobs keys `<id>:<flow>:<entered>` so a repeat enqueues nothing: for an instance in a step state, `<id>.<state>`; in a wait state, `<id>.wake` after `ms`; in a final state, `<id>.forget` after `keepMs`. Job inputs are `{ id, entered }`, never `data`. A step job, through `commitStores` (k.persist): stops if the instance has moved; commits `attempt`; past `attempts`, commits `failed` `{ code: 'workflows.attempts' }`; else calls `run` with `signal` and `key`, then commits `done` with its `ok` value, or on the last attempt `failed` with the `err` code. A wake job commits its event if the instance is still there. A wait therefore lasts at least `ms`, later by the time the runner took to see the instance.

**Crashes and replay.** A step runs at least once (std.jobs); `key` is the same on every run of one entry, so the effect it calls can deduplicate. After a crash the instance is in the store as committed: its step's job runs again once its lease expires, or its result is committed and the next run stops. Every change is an entry of the store's log, step results as `done` and `failed` payloads, so replaying the log reproduces every instance without running a step. Compensation is chart states: a `failed` event leads to states whose steps undo earlier ones.

**Inspect.** `workflows.instances`: per workflow, a count per state; no `data`.

**Rules.** E2351 a `workflow` outside `*.server.ts`, or an id not prefixed by its module (fix prefixes it) · E2352 a step or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on` (no fix; `workflow` throws it) · W2353 a step's `failed` target is final while another step's `done` lies on a path to it, so its effect is never undone (names both) · E2354 a module whose `queue` lacks a workflow's `jobs` or whose `runners` lack its `flows` (fix adds them).

**Conformance.**
- For generated instances and events, a workflow event changes only its instance, to `chart.next` of it.
- Under sim, a started instance reaching a step state runs `run` once with `key` `<id>:<flow>:<entered>` and moves by its `done` event with the `ok` value.
- A `run` that returns `err` 3 times with `attempts: 3` leaves the instance after its `failed` event with that code; one that never settles ends there with `workflows.attempts`.
- A wait state moves by its event when the sim clock passes `ms`, not before; an undo sent first leaves the wake job doing nothing.
- After `close()` while `run` is pending, a new `createApp` on the same ctx runs it again with the same `key`, and the instance takes its `done` event once.
- Restoring the store's snapshot and replaying its log from `initial` gives its state.
- `workflows.instances` holds counts and no `data` value.
- E2351, E2352, W2353 and E2354 each fire on a fixture and not on its clean twin; `workflow` throws E2352.
~~~

### spec/std/std.shells.md (new, 526)
~~~md
# std.shells: Shell drivers
status: proposed

**Extension points.** Drivers (k.persist): `@keel/std-capacitor` and `@keel/std-tauri` supply the `storage` and `net` a shell build's generated entry passes to `createCtx({ mode: 'shell', drivers })` (k.shell). App code never imports them.

**API** (browser; one export each).
```ts
const drivers = capacitorDrivers({ origin: new URL('https://golden-1.example') })   // @keel/std-capacitor
const drivers = tauriDrivers({ origin: new URL('https://golden-1.example') })       // @keel/std-tauri
```
Each returns `{ storage, net }` keeping k.persist's and k.shell's contracts:
- `@keel/std-capacitor` (Capacitor 8): `storage` on `@capacitor/preferences`; `net` on `CapacitorHttp` from `@capacitor/core`, whose cookies the native cookie store keeps (`CapacitorCookies`). The global `fetch` stays unpatched.
- `@keel/std-tauri` (Tauri 2, desktop): `storage` on `@tauri-apps/plugin-store`, file `keel.json` in the app's data directory, saved before a write resolves; `net` on `@tauri-apps/plugin-http`'s `fetch`, which the generated capability allows for `origin` only.
- `commit` is atomic because the package runs its storage calls one at a time, and one page owns the store.
- `net.fetch` maps a request on the page's origin to `origin` and returns a standard `Response`; a failure rejects with a `TypeError`, which k.services reports as `api.network`.

**Conformance** (Capacitor's web implementations and Tauri's `mockIPC` under jsdom).
- Each package's `storage` passes k.persist's storage clauses.
- A value `set` through one driver is read by a new driver over the same native store, as after an app restart.
- From a page at `capacitor://localhost`, `fetch('/api/lists')` reaches `https://golden-1.example/api/lists` with its method, headers and body; `https://other.example/x` keeps its URL.
- A cookie set by a response from `origin` is sent on the next request to `origin` and on none to another origin.
- A refused connection rejects with a `TypeError`, and a k.services call over it is `api.network`.
- Neither package replaces the global `fetch`.
~~~

### spec/00-map.md (orchestrator)
- Kernel table, after k.topology: "| k.deploy | Builds, storage and deploy files | proposed | `server.mjs`, `DeployEnv`, `storage`, Dockerfiles, compose, CI |"; after k.sync: "| k.persist | Storage and durable state | proposed | `read`, `commit`, drivers, saves across processes, `commitStores`, older snapshots |"; "| k.shell | Native shells | proposed | Capacitor and Tauri: shell ctx, files, `keel build --target` |"; after k.model: "| k.prove | Proving invariants | proposed | induction with Z3 over a declared fragment |".
- Code ranges: E155x owner gains "k.deploy, k.shell"; E160x "k.ctx, k.persist"; E170x gains "k.prove"; add "| E215x | std.db | E235x | std.workflows |" and the note "wave-0 blocks E210x and E230x are E2100-E2149 and E2300-E2349". About 90 tokens.

### spec/std/README.md (orchestrator)
```
| std.db | SQLite and Postgres storage | proposed | storage drivers (k.persist) and check rule registry: E2151-E2153 |
| std.workflows | Workflows | proposed | module manifest, inspector hook, check rule registry: chart instances over jobs, E2351-E2354 |
| std.shells | Shell drivers | proposed | storage and net drivers for Capacitor and Tauri shells |
```

## Conformance diff
Each lane's conformance-writer writes these from the accepted text, skipped until implementation; each new clause is cited verbatim by exactly one file.

- **Kernel, edited headers (one `rfc:0085` commit in the kernel lane).** The two clauses that move from k.topology to k.deploy keep their text; their files change section id from `k.topology` to `k.deploy` (expected `packages/server/conformance/start-env-e1560.test.ts` and `packages/scaffold/conformance/deploy-files.test.ts`, or wherever the S3 conformance-writer put them: the orchestrator lists them with `grep -rl 'Spec: k.topology' packages/*/conformance`). No assertion changes. k.topology's later clauses renumber in the ledger; the orchestrator rewrites `tooling/ledger/ledger.json` with `pnpm ledger` in the batch.
- **Kernel, added.** k.persist: `packages/ctx/conformance/storage-read.test.ts`, `storage-commit.test.ts`, `storage-serial.test.ts`, `drivers-e1605-e1606.test.ts`, `drivers-real.test.ts`; `packages/server/conformance/save-across-apps.test.ts`, `save-atomic.test.ts`, `commit-stores-retry.test.ts`, `commit-stores-save-events.test.ts`; `packages/store/conformance/restore-older-snapshot.test.ts`. k.deploy: `packages/server/conformance/start-database-url.test.ts`; `packages/scaffold/conformance/dockerfile-storage.test.ts`; `packages/check/conformance/E1572.test.ts`. k.shell: `packages/scaffold/conformance/shell-files.test.ts`, `tauri-conf.test.ts`; `packages/check/conformance/E1573.test.ts`; `packages/cli/conformance/build-target-e1574.test.ts`, `build-target-e1575.test.ts`; `packages/compiler/conformance/shell-entry.test.ts`. k.compat: `packages/check/conformance/E1563-W1564.test.ts`. k.prove: `packages/testing/conformance/prove-counter.test.ts`, `prove-e1715.test.ts`, `prove-unique-ids.test.ts`, `prove-not-inductive.test.ts`, `prove-initial.test.ts`, `prove-deterministic.test.ts`, `prove-e1717.test.ts`, `prove-e1718.test.ts`. k.ledger: `packages/cli/conformance/ledger-prove-rung.test.ts`.
- **std-db, added.** `driver-contract`, `two-processes-409`, `sigkill-restart`, `serial-commits`, `layout-e2152`, `e2153-no-value`, `e2151`, `secure-delete` (`.test.ts` in `packages/std-db/conformance/`); Postgres clauses run on PGlite locally and against the CI service when `KEEL_TEST_POSTGRES_URL` is set.
- **std-workflows, added.** `next-per-instance`, `step-runs`, `step-fails`, `wait`, `restart-step`, `replay`, `inspect`, `rules`.
- **std-jobs, added.** `two-runners-once`. **std-statecharts, added.** `next`.
- **std-capacitor and std-tauri, added.** `storage-contract`, `restart`, `origin-map`, `cookies`, `network-error`, `no-global-fetch`, one set per package.
- **Not conformance.** Property tests per package: generated `commit` sequences against a model map (ctx, std-db); generated chart declarations whose `next` agrees with `tx`; generated stores in the fragment whose `prove` verdict agrees with `explore` on a bounded copy (when `explore` finds a broken state, `prove` must not pass); `accepts` on generated store schema pairs (k.compat's existing property covers the relation).

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (k.persist, k.deploy, k.shell, k.prove, std.db, std.workflows, std.shells new; the k.store, k.ctx, k.server, k.topology, k.compat, k.ledger, std.jobs and std.statecharts edits; the map and `spec/std/README.md`). Write the ADRs. Create `packages/std-db`, `std-workflows`, `std-capacitor` and `std-tauri` in the std-money shape (`package.json` with exports: std-db `./sqlite`, `./postgres`, `./tools`; std-workflows `.`, `./tools`, `module.ts`; the shell packages `.`), `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, empty `src/index.ts`, `conformance/`, `unsafe/`. Add dependencies: `pg` and dev `@electric-sql/pglite` to std-db; `@capacitor/core`, `@capacitor/preferences` to std-capacitor; `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-http` to std-tauri; `z3-solver` as an optional peer and dev dependency of `@keel/testing`; the `./prove` export of `@keel/testing`; golden-1's list (Proposal 9). Set `tooling/deps.json`: `std-db` after `ctx`; `std-workflows` after `std-statecharts` and `std-jobs`; `std-capacitor`, `std-tauri` after `std-db`. Add `tooling/budgets.json` entries and re-bases (Token impact). Run `pnpm install` once, so no lane touches `pnpm-lock.yaml`. Schedule backlog 0257 before the batch (Privacy). Run the conformance-writers. Shared files stay with the orchestrator: `spec/**`, `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/THREAT-MODEL.md`, `docs/TESTING.md`, `docs/HANDOFF.md`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel (K1 to K4; K5 and K6 entries) | `packages/ctx/**`, `packages/store/**`, `packages/server/**`, `packages/compiler/**`, `packages/check/**`; the kernel conformance files above for ctx, store, server, compiler and check, and the header edits; kernel changesets | nothing; commits K1 (`read`, `commit`, drivers, sim), then K2 (saves, `commitStores`), then K3 (restore), then the node entry's `storage` import and the shell entry, then K4 | `pnpm --filter @keel/ctx --filter @keel/store --filter @keel/server --filter @keel/compiler --filter @keel/check run check`, the same with `run test` |
| db | `packages/std-db/**` | K1 for the contract (writes against the spec text first); the node entry for its end-to-end clauses | `pnpm --filter @keel/std-db run check && pnpm --filter @keel/std-db run test` |
| workflows | `packages/std-workflows/**`, `packages/std-jobs/**`, `packages/std-statecharts/**` | K1 for std.jobs' commits, K2 for `commitStores` | `pnpm --filter @keel/std-workflows --filter @keel/std-jobs --filter @keel/std-statecharts run check`, the same with `run test` |
| targets (K5 and K6 files and build) | `packages/std-capacitor/**`, `packages/std-tauri/**`, `packages/scaffold/**`, `packages/cli/src/**` except the ledger files below, `packages/cli/conformance/build-target-*`, `tooling/generate.mjs`, `tooling/ci.source.json` and the workflows it writes, `tooling/deploy.source.json`, `tooling/smoke/shell.mjs` (new) | the shell entry from the kernel lane | `pnpm --filter @keel/std-capacitor --filter @keel/std-tauri --filter @keel/scaffold --filter @keel/cli run check`, the same with `run test`, `node tooling/generate.mjs --check` |
| verify (K7) | `packages/testing/**`; in `packages/cli`: `src/internal/testFacts*.ts`, `src/internal/buildLedger.ts` and `conformance/ledger-prove-rung.test.ts` | nothing; its first commit is the Z3 spike over golden-1's six board obligations, recorded in `tasks/0338-s8-reach/PLAN.md` | `pnpm --filter @keel/testing run check && pnpm --filter @keel/testing run test`, then `pnpm --filter @keel/cli run test -- ledger` |
| golden | `apps/golden-1/**`; `evals/tasks/golden-1-api/**` (TASK.md, acceptance test, `pass.ts`; `spec-slice.txt` gains key lines of k.persist, k.deploy, std.workflows and k.prove); `tooling/smoke/restart.mjs`, `tooling/smoke/workflow.mjs` (new) | every lane | `pnpm --filter golden-1 run check && pnpm --filter golden-1 run test && pnpm eval --task golden-1-api --runner none --strict` |

Order: kernel, db, verify and targets start at once (db writes its drivers against the k.persist text with a local contract test; targets writes the shell packages and generator templates against the spec text). workflows starts std.statecharts' `next` and its rules at once, and its runner once K2 lands. golden starts with the removal chart, schemas and eval task, and finishes last. That is five implementation agents and one kernel agent, the program's batch budget. After the batch, alone: mutation for `@keel/ctx`, `@keel/store`, `@keel/server`, `@keel/testing`, `@keel/std-db` and `@keel/std-workflows`, one at a time; then `pnpm ledger`. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, `pnpm ledger --diff`, the shell and Postgres CI jobs green on the pushed branch, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package): 0304 (kernel lane, `packages/compiler` and `packages/server`: node build CSS) and 0313 (kernel lane, `packages/compiler`: the project evaluator without a DOM) if S3 left them open, since the kernel lane changes the generated entries. 0257 and 0261 (`packages/check` rule design for revealed secrets and whole-object copies) do not ride: they need their own design, and the orchestrator runs 0257 before this batch because std.db makes its leak durable. 0273 and 0274 belong to S3's lane. 0335 (`tooling/budgets.mjs`) and 0293, 0294 (dependency pins) stay outside.

## Migration
- **Kernel callers.** `read`, `commit`, `drivers`, `commitStores`, `storage`, `shells`, `--target` and `prove` are additions. A custom `KeyValueStorage` (none exists outside `@keel/ctx`) must add `read` and `commit`. `restore` now returns `ok` for snapshots it used to refuse; no caller relied on that `err` (`openStores.ts` threw on it). A deployable without `storage` keeps `'file'` and today's Dockerfile.
- **The k.topology split.** Two conformance headers change section id (Conformance diff); k.topology's clause items after the moved ones renumber, and `pnpm ledger` rewrites the committed ledger.
- **std.jobs.** Leases gain an end; a stored queue without one reads as ended, so jobs leased before the upgrade run again at the first start, as RFC 0080 specified for a restart.
- **golden-1** (D2). As Proposal 9 lists. Its stored `.api.storage` file (dev) is not migrated: `storage: 'sqlite'` starts from an empty database, and `keel dev` keeps `.keel-dev/`; the README says to re-run the seed script.
- **Docs** (orchestrator). docs/ARCHITECTURE.md: Borrow vs build rows "Durable storage: borrow `node:sqlite` and `pg`; build the storage contract and drivers; no ORM", "Workflows: build on charts and jobs; no workflow engine", "Native shells: borrow Capacitor (mobile) and Tauri (desktop); build drivers", "Proofs: borrow Z3 (`z3-solver`); build the translation from schemas and a declared fragment"; the stdlib paragraph gains the four packages. docs/TESTING.md: the `proven` rung reads "type-level tests; closed-form `explore`; `prove` (SMT)". docs/THREAT-MODEL.md: the database URL, data at rest in std.db, the shell's cookie store and origin, and 0257's stake. The `keel-api` skill gains `storage` in `topology.ts`, `commitStores` for runners and jobs, and workflows; the `keel-testing` skill gains `prove` and when `explore` stays the tool. Each new package gets a README in the std-money shape.

## Token impact
Sections after the change are in Spec diff. Headroom left: k.store 10, k.ctx 5, k.server 21, k.cli 0: their next change needs a split first (k.store's seam: Log meta, Log limit and Secrets into a log section; k.ctx's: its Rules paragraph; k.server's: Server state into k.persist). The widest task here, golden-1's removal workflow, reads std.workflows, k.persist and std.statecharts: 3,766 tokens. A deploy task reads k.topology and k.deploy: 1,917.

Package sizes (gzip; `tooling/budgets.mjs` rule; estimates unless marked):

| Package | Estimate | `budgets.json` |
| --- | --- | --- |
| `@keel/ctx` | +0.4 kB (`read`, `commit` in three implementations, drivers) over RFC 0082's about 2.7 kB | `3kb` is crossed; re-base to `3.5kb` with the measured bytes in the commit (default 7) |
| `@keel/server` | +0.35 kB (`commitStores`, commit-based saves) | `16kb` holds (RFC 0080 left about 0.8 kB) |
| `@keel/store` | +0.05 kB | holds |
| `@keel/compiler`, `@keel/check` | +0.4 kB, +0.6 kB | `29kb`, `36.5kb` (RFC 0080) hold |
| `@keel/scaffold` | +1.6 kB (storage Dockerfiles, eight shell templates) | `16kb` (about 1.3 kB left after RFC 0080) is crossed; re-base to `18kb` |
| `@keel/cli` | +1.1 kB (`--target`, toolchain probes, prove evidence) | `22kb` holds |
| `@keel/testing/prove` | 4.5 kB (translator, sorts; `z3-solver` external) | new `{ "max": "5kb", "platform": "node" }`; the main entry is unchanged |
| `@keel/std-db/sqlite`, `/postgres`, `/tools` | 1.2 kB, 1.4 kB (`pg` external), 1.2 kB | `{ "max": "1.5kb", "platform": "node" }`, `{ "max": "2kb", "platform": "node" }`, `{ "max": "1.5kb", "platform": "node" }` |
| `@keel/std-workflows`, `/tools` | 2.8 kB, 2.5 kB | `{ "max": "3kb", "platform": "node" }`, `{ "max": "3kb", "platform": "node" }` |
| `@keel/std-capacitor`, `@keel/std-tauri` | 0.9 kB each, plugins external | `"1kb"` each |

A golden-1 shell bundle adds about 0.9 kB of Keel driver code plus the shell's JavaScript plugin bridges; a browser build adds nothing. `server.mjs` grows by `pg` bundled (about 30 kB minified) only for `'postgres'`.

## Known limits
- **Fan-out stays per process.** std.channels pushes reach streams open in the process that saved; replicas share data through std.db but not pushes (a broker is a later RFC).
- **No derived migration for computed changes.** A state change the new schema refuses is E1563; an app that must transform stored state declares a new store id and moves the data with a runner through `commitStores`. A rename of a transaction folds old logs, so write keys in them stop deduplicating resends.
- **History is the kept log.** std.db keeps what the snapshot keeps (`logLimit` entries); there is no audit table.
- **One snapshot per workflow.** Every save writes all instances of a workflow; `limit` (default 1,000 active) bounds it, and a workflow with more active instances needs to be split by key into several workflows.
- **Waits can run late** by the runner's delay in seeing an instance (at most 60,000 ms when another replica saved it, or the downtime after a crash). They never run early.
- **Steps run at least once.** `key` lets an effect deduplicate; an effect that cannot is the app's risk, as with any std.jobs job.
- **SQLite on network file systems** is not supported; replicas that share a database use Postgres.
- **Shell coverage.** CI replays the session only in the Tauri Linux shell; Android replay is nightly once stable, iOS and macOS runs are manual; Windows builds are untested in CI. No signing, notarization or store upload. Icons are the shells' template defaults until a later RFC generates them from the brand mark.
- **The Capacitor policy is a meta tag,** which ignores `frame-ancestors`, `report-uri` and `sandbox`.
- **The fragment.** `prove` covers what Proposal 7 lists; `filter`, loops, calls and non-integer arithmetic are E1715. A verdict is tied to the Z3 version; quantified obligations can be E1717 on a future version.
- **Encryption at rest** is the host's or volume's, not std.db's.

## ADRs
Written with this RFC's acceptance in `docs/adr/`, after RFC 0084's ADR-0097 to ADR-0102: 0103 storage contract and drivers, 0104 SQLite and Postgres drivers, 0105 stored-data compatibility and log folding, 0106 workflows, 0107 native shells, 0108 proofs.
- **0103 `ctx.storage` gains `read` and `commit`, and drivers replace implementations per ctx** (K1, K2, k.persist). Server saves are one `commit`, `commitStores` gives runners and jobs the action's save path, and a `sim` ctx refuses drivers. Chosen over a database API beside storage (two paths) and over in-process conflict checks (one process only).
- **0104 std.db stores snapshots in SQLite through `node:sqlite` and in Postgres through `pg`** (std.db, K5). Two tables, std.db's own layout version, no app DDL; `storage` in `topology.ts` picks the driver and `KEEL_DATABASE_URL` locates it. Chosen over better-sqlite3 (native addon, not bundleable), postgres.js (new major) and tables per schema field (a second representation).
- **0105 Schema changes are checked against stored data, and unreplayable logs fold** (K3, K4). `surface.json` carries stores; `--base` refuses a state change stored states fail (E1563) and warns of a transaction change (W1564); `restore` keeps state and head and drops entries it cannot replay. Chosen over hand-written migration scripts for every change and over refusing to start.
- **0106 A workflow is a chart run per instance in one server store, with steps and waits as std.jobs jobs** (std.workflows). Transitions are transactions, step results are entries, compensation is states, and the closed-form `explore` of the chart covers every instance. Chosen over a workflow engine with code replay, over a store per instance and over retries outside std.jobs.
- **0107 Capacitor packages the `client` deployable for mobile and Tauri for desktop, through generated read-only files and `shell` drivers** (K6, std.shells). The page origin maps to `KEEL_ORIGIN` through native HTTP; storage is native; the policy applies in both. Chosen over Tauri Mobile (Rust and NDK for mobile, no stated stability), over the webview's `localStorage`, and over committed native projects.
- **0108 `prove` checks inductive invariants with Z3 over a declared fragment** (K7, k.prove). Sorts come from schemas, functions from their source; `unsat` is `proven`, `sat` a counterexample, outside the fragment no claim. Chosen over bounded enumeration (no `proven`), symbolic execution of all TypeScript (unsound edges) and external model languages.

## Open questions
None. The seven escalations the defaults required are answered as D1 to D7.

**Borrow vs build, decided by defaults 1 to 3 with evidence** (Proposal 10).
- **`node:sqlite`, not better-sqlite3.** Built into Node 22.13+ and measured working here; better-sqlite3's `.node` prebuilds cannot be bundled into `server.mjs`.
- **`pg`, not postgres.js.** Pure JavaScript with a stable 8.x API; postgres.js's 4.x is days old. PGlite (PostgreSQL 18.6 in WASM) runs the Postgres clauses in `pnpm test` without a server; CI adds a real one.
- **Capacitor for mobile, Tauri for desktop, not Tauri Mobile.** Capacitor 8's mobile toolchain needs no Rust and its storage and HTTP are first-party; Tauri 2 gives small desktop binaries and WebDriver on Linux, which the CI replay needs.
- **Z3 through `z3-solver`, not bounded exploration, for `proven` beyond finite spaces.** Bounded exploration is `exhaustive` by definition and `explore` already provides it; Z3 decides the fragment's obligations, including the quantified array facts golden-1's invariant states. It is an optional, unbundled Node dependency (40 MB), so apps that never call `prove` do not install it. The verify lane's first commit measures Z3 on golden-1's six obligations; if any is E1717, the eval's `proven` set shrinks to those Z3 decides and Known limits names the rest before the batch ends.
