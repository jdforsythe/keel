# RFC 0080: S3 Server depth: deployables, jobs, schedules, streams and surface compatibility

Status: implemented. Accepted (2026-11-10); the user's answers are D1 to D4, and D5 reconciles the stream transport with RFC 0081. Stage design RFC for S3 (`tasks/PROGRAM.md`, task 0309). It applies WORKFLOW RFC defaults 1 (each gap the stdlib packages expose gets a kernel change: K1 to K7), 2 (the generated production entry replaces the hand-written `server.ts` in every app; one HTTP client for every call between modules; one stream transport, which S4 builds on), 3 (the deploy files reuse the scaffold's generators and `tooling/generate.mjs --check`; the compat rules run in the check pipeline; the exit proof extends the existing `golden-1-api` eval), 4 (job inputs that hold a secret are refused, the inspector shows no input, event streams store nothing), 5 (jobs and schedules are server-only; nothing new reaches a browser unless a route the app declares sends it), 6 (E1558 to E1562 and E2501 to E2553 enforce what prose would otherwise ask for) and 7 (`@keel/server`, `@keel/compiler` and `@keel/check` budgets are re-based; no threshold is lowered). ADR-0073 to ADR-0079 record it.

## Decisions (2026-11-10)
- D1 (user): the API shapes are accepted as a set: `service({ module })` and `events: true` endpoints, `runners.server.ts`, live loaders, the std-jobs and std-schedules APIs, `keel codemod place`, `keel check --base`.
- D2 (user): the golden-app migrations are approved: generated entries replace every hand-written `server.ts` (golden-1, golden-2, `apps/sessions`), and golden-1 gains the `digest` module.
- D3 (user): Docker and CI as Proposal 6 describes: `node:22-slim` pinned by digest (the multi-platform index `sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d`, read with `docker buildx imagetools inspect` on 2026-11-10), a generated workflow that builds images and never pushes, and a golden-1 image-build job in this repository's CI.
- D4 (user): one `KEEL_SECRET` per app, shared by its deployables.
- D5 (reconciliation with RFC 0081): the stream transport is the kernel's alone, a k.server live loader read by a k.services `events` endpoint (Proposal 4). `@keel/std-streams` is not created: its topic fan-out would be a second fan-out beside std.channels' hub, its replay by id is what RFC 0081 declines (no resume), and its reconnect would be a second backoff beside std.channels' `subscribe` (principle 1). Its draft APIs (`topic`, `publish`, `follow`, `subscribe`) and codes leave with it; E2600-E2649 stay std.channels'.

Design basis: RFC 0079 as accepted (its spec diff is not yet in `spec/`). Every count below for k.server applies 0079's edit first (1,500 to 1,462). If 0079 changes again before the S3 batch, only the k.server counts move; nothing here depends on 0079's other sections.

## Problem
S3 must show that a deployable composition declared in `topology.ts` can be split into several artifacts without a source change, and add background jobs, schedules and long-lived responses. Today:

1. **A deployable's entry is hand-written.** `apps/golden-1/server.ts`, `apps/golden-2/server.ts` and `apps/sessions/server.ts` each import one module's `routes`, name their deployable (`const DEPLOYABLE = "api"`), read their own environment variables and call `serve`. Moving a module to another deployable means editing those files. `createApp` serves one manifest and keeps the routes whose module the served deployable lists (`packages/server/src/internal/selectDeployable.ts`); merging modules is left to the author.
2. **Calls between deployables have no kernel path.** k.server says "calls between deployables are stdlib". The golden apps call their api with `service({ base: new URL(url).origin })` and rely on a Vite proxy for `/api` that exists only in dev and preview. Nothing in production routes a request to the deployable that serves it, and nothing checks that a caller's endpoint schemas match the route it calls: `apps/golden-2/modules/recipes/kitchen.service.ts` restates `kitchen`'s answers by hand, and `kitchen` lists no public route.
3. **A server has no lifecycle.** `createApp` returns `{ fetch }` only: no start hook, no `close`, no signal, no background work (`packages/server/src/types/ServerApp.ts`). A job queue or a schedule has nowhere to run and no moment to stop.
4. **No response streams.** A document is one string (`documentResponse.ts`); a loader returns one `Result`.
5. **No deploy files.** `docs/ARCHITECTURE.md` lists Dockerfiles and compose among the generated, read-only files and `packages/scaffold/src/internal/isGenerated.ts` refuses to edit them, but nothing generates them. `keel check` reports E1005 only for `.keel/*.json`.
6. **No compatibility rule.** Once deployables ship separately, an api change can break a caller that is still running the older code. No artifact records the surface a caller was built against.

Platform facts, measured on Node 22.23.1 and 24.19.0: `EventSource` is undefined without `--experimental-eventsource` on both; `ReadableStream` and `TextDecoderStream` exist on both; `localStorage` needs `--experimental-webstorage` with `--localstorage-file` on both (24.19.0 with only `--localstorage-file` has none); `Intl.DateTimeFormat` with `timeZone: 'Europe/Berlin'` writes `03:30` for 2027-03-28T01:30Z and `02:30` for both 2026-10-25T00:30Z and 01:30Z (the spring gap and the autumn overlap the std.schedules clause uses); no runtime has a cron facility.

## Proposal

### 1. What a split is
A split moves modules between deployables by editing `topology.ts` and nothing else. Precisely, for two builds of one commit whose only differing source file is `topology.ts`:

- every file under `modules/`, `tokens.ts`, `vite.config.ts`, `package.json` and the tests is byte-identical;
- the generated files (`.keel/`, `deploy/`, the CI workflow, `dist/`) differ, and each is fresh (no E1005);
- a client of the app sees the same statuses, bodies, event streams and stored state through any `node` deployable, up to the ids `ctx.random` mints.

Three rules make that hold. Placement lives only in `topology.ts` (routes, actions, live loaders, jobs and schedules belong to a module, and a module to one deployable). A module calls another module's routes only through a k.services client, `service({ module })`, which encodes, checks and decodes the same way whether the callee is in the same process or a peer, so co-location never changes a value. And every module's state lives in its own `ctx.storage` keys or its own memory, never shared across modules, so a module carries its state with it.

### 2. Kernel changes
Exact text is in Spec diff. ADR outlines are below.

- **K1, k.topology (new section): placement, route table, runners, peers, production entry, deploy files, local topology.** k.server's Topology paragraph and its rules E1552 and E1553 move here unchanged in meaning, so no conformance header changes.
- **K2, k.server: live loaders and the public origin.** A loader whose `fn` is an async generator is live: a document or JSON GET takes its first yield; a GET with `accept: text/event-stream` gets every yield as one `data:` line (its `Result` JSON), with a `:` line each 15 s on `ctx.clock`, until `fn` returns or its `signal` aborts (request abort, `close()`); a guard denial there is 403 `keel.denied`. E1558 refuses a live loader in a non-`node` deployable. `createApp({ origin })` sets the public origin, which replaces the request's in `url`, the same-site check and `Secure` (closes backlog 0273 and the proxy half of 0274); its text sits in k.topology beside `KEEL_ORIGIN`, since k.server has no room.
- **K3, k.topology runners and `close()`.** `modules/<id>/runners.server.ts` exports `runners`, a list of `Runner`s `{ run(ctx, signal) }`; `createApp({ runners })` runs the served deployable's runners once after startup and restarts a rejected one after 1,000 ms on `ctx.clock`; `app.close()` aborts every runner's `signal` and every open event stream and resolves when every `run` has settled. This is the lifecycle std-jobs and std-schedules need (default 1). No new `ctx` capability: scheduling is `ctx.clock.after(ms, signal)`, which already exists with real, shell and sim implementations, and the process lifecycle is the `signal` each runner gets.
- **K4, k.services: `service({ module })` and `events` endpoints.** `module` names an app module whose routes the client calls; k.topology resolves it in process, to a peer's URL, or in a browser to the document's origin. A GET endpoint with `events: true` reads a live loader as an `AsyncIterable<Result<T, ApiError>>`, with no reconnect or resume. This replaces "calls between deployables are stdlib": one client for every HTTP call (default 2).
- **K5, k.module: calls are access.** A `service({ module })` endpoint is cross-module access like an import or an `href()`: E1152 without the module in `deps`, E1157 for a route outside its `public.routes`.
- **K6, k.compat (new section): surface compatibility.** `.keel/surface.json`, the `accepts` relation on schemas, E1561 (an endpoint the route refuses, in the tree) and E1562 (a route change a deployed caller in another deployable refuses, with `keel check --base`).
- **K7, k.scaffold: deploy files and `place`.** The `project` generator and the operations that change modules write the deploy files; `keel codemod place <module> --to <deployable> [--adapter]` is the split as an operation (principle 7).

No change to k.ctx, k.router, k.compiler, k.check, k.cli, k.testing or k.errors text. The implementation touches `packages/router` (the loader type accepts an async generator), `packages/compiler` (the server bundle, the local topology in the dev server, the `surface.json` artifact), `packages/testing` (the harness takes a live loader's first yield, as the server does) and `packages/cli` (`--base`, deploy file freshness, `keel dev` storage flags) without changing their sections: each behavior is specified in the section that owns the concept (k.server, k.topology, k.compat).

### 3. Package contracts
Each package is a stdlib module (k.module extension point) with a `module.ts` at its root, one export per file, schemas first, every effect through `ctx`. Dependency order in `tooling/deps.json`: `std-jobs`, then `std-schedules`, after S2's `std-messages`. Diagnostic blocks of 50, as the kernel's: E2500-E2549 std.jobs, E2550-E2599 std.schedules; RFC 0081 takes E2600-E2749; E22xx and E29xx stay unassigned (fixture codes, RFC 0079).

| Package | Purpose | Extension points | Rules | Effects | Size (gzip) |
| --- | --- | --- | --- | --- | --- |
| `@keel/std-jobs` | Durable background jobs per module: enqueue, retry with backoff, lease, restart | module manifest; inspector hook `jobs.queue`; check rules | E2501-E2504 (`./tools`) | `clock` (`now`, `after`), `random.id`, `storage` | 2.5 kB node; `./tools` 2 kB |
| `@keel/std-schedules` | Five-field cron in a time zone, enqueuing a module's jobs, with catch-up after downtime | module manifest; check rules | E2551-E2553 (`./tools`) | `clock`, `storage`; `Intl.DateTimeFormat` for zones | 2 kB node; `./tools` 2.5 kB |

**std-jobs.** A job is `job({ input, attempts, timeoutMs }, fn)` in its own `*.server.ts` file; a module's jobs are one table, `export const jobs = queue({...})` in `modules/<id>/jobs.server.ts`, keyed by module-prefixed ids. `jobs.enqueue(ctx, id, input, { delayMs?, key? })` is typed by the table, as `routes.href` is by the manifest. The queue is a `Runner`: the module lists it in `runners.server.ts`, so it runs where the module is placed. Jobs run at least once: a job leased when a process stops runs again at the next start, so `fn` must be idempotent, and `key` makes an enqueue idempotent too (it matches a pending job or one of the last 1,000 finished). A module enqueues only its own jobs (its queue is never public, E2502); another module asks it through one of its actions over k.services, so a job can never land in a deployable that does not run it. Concurrency is the module's `std['@keel/std-jobs']` config, `{ concurrency }`, 1 to 16 (k.module std config, server-only).

**std-schedules.** `schedule(jobs, { '<module>.<name>': { cron, zone, job, input, missed } })` is a `Runner` that enqueues `job` at each fire time with key `<id>@<t>`, then stores the fire time as its mark. The key makes a crash between the two steps harmless; the mark lets a restart catch up (`missed: 'once'`, the default, enqueues one job for the latest missed time; `'skip'` none). `cron` is the POSIX five-field subset with steps; anything else is E2551 at check time from the literal and a throw at construction. `zone` is S2's `temporal.TimeZone`; local times come from `Intl.DateTimeFormat`, with the gap and overlap rules in std.schedules.

**Streams.** No package (D5). Streaming is the kernel transport of Proposal 4: a live loader serves a stream and an `events` endpoint reads one. Fan-out to the streams open in a process, membership and reconnect policy are a consumer's, and S4's std.channels is the first.

**What survives a restart, and where.**

| State | Where | Survives a restart | Privacy |
| --- | --- | --- | --- |
| Request-scope server stores (existing) | `ctx.storage` `keel.store.<id>` | yes | as today |
| Job queue, leases, last 1,000 finished keys, newest 100 failures | `ctx.storage` `std.jobs.<module>` | yes | inputs encoded by their schema; `s.secret` refused (E2503); failures keep the error code, never the input; the inspector shows counts and codes |
| Schedule marks | `ctx.storage` `std.schedules.<module>` | yes | fire times only |
| Open event streams | the serving process | no; a client reopens and re-reads | nothing stored; an event reaches a client only through a route the app declares, behind its guard |
| Production storage | the file `--localstorage-file` names, on volume `/data` in the image | yes | the volume belongs to one deployable |

### 4. Stream transport: the contract RFC 0081 builds on
S3 defines one way to stream (D5). RFC 0081's std.channels builds on it as follows, by its requirements T1 to T6:

- **T1, route kind.** A live loader: a route's `loader` whose `fn` is an async generator, in a `node` deployable (E1558). Its `output` schema types each event and encodes it. There is no `stream` route field: a second server-function kind beside `loader` would be a second way to read (principle 1), and k.router has no room.
- **T2, loader request flow.** An event-stream GET runs the loader flow: `params` and `search` parsed by schema (404), then guards before the first byte, where a denial answers 403 `keel.denied` (a stream has no document to redirect); `caller` comes from the signed cookie and is never minted (k.server mints only on a write); the loader's `stores` factory runs once at open, and nothing saves.
- **T3, lifetime.** `fn` gets `signal`, aborted when the request aborts and when `app.close()` runs; the stream ends when `fn` returns or `signal` aborts; a `:` heartbeat goes out every 15 s of `ctx.clock`. The kernel sets no cap on open streams: a cap is a consumer's policy, and std.channels' `perCaller` and `maxStreams` config is where it lives.
- **T4, reader.** A k.services endpoint with `events: true`, read over `ctx.net.fetch` with a streaming body, through `service({ base })` or `service({ module })`. Each `data:` line is the loader's `Result` JSON: an `ok` value is decoded with `output`, an `err` arrives as `api.status` (200, `body` the error) and ends the iteration. It never reconnects; the caller owns its backoff on `ctx.clock`.
- **T5, sim.** `createApp`'s `fetch` returns the stream as a `Response` body, so a sim net route `req => app.fetch(req)` carries it unchanged; when the body errors (RFC 0081's offline switch), the reader yields `api.network` and ends.
- **T6, no resume.** None is provided: no `id:` lines, no `Last-Event-ID`, nothing kept after an event is written. A consumer that needs to catch up re-reads on open, as std.channels' `reset` does.

Wire format: `content-type: text/event-stream`, `cache-control: no-store`, one `data: <Result JSON>` line and a blank line per yield, a `:` line and a blank line per heartbeat. The writer borrows Hono's `streamSSE` (`hono/streaming`, already a dependency of `@keel/server`; RFC 0081 measured it through `app.fetch` and a sim net route), with heartbeats driven by `ctx.clock`; the reader is built in `@keel/services`, since fetch streams and `TextDecoderStream` exist on Node 22, Node 24 and every browser Keel targets.

**What RFC 0081 changes to match** (for the S4 agent):
1. `channelRoute` returns `{ id, path, loader, actions: { POST } }`, its `loader` a live loader yielding `ChannelEvent<M>`, instead of a `stream` field.
2. `subscribe` reads through a k.services `events: true` endpoint built from the channel declaration (`publish` already goes through `@keel/services`). There is no "std.streams reader", no `@keel/std-streams` package and no `std-streams` entry ahead of `std-channels` in `tooling/deps.json`. Its ARCHITECTURE row reads "Server push: borrow Hono `streamSSE` through k.server live loaders; build invalidation and channels".
3. T3's configurable cap is std.channels' own config; the kernel adds none.
4. k.server is 1,491 tokens with this RFC, and RFC 0081's Server state edit makes it 1,499 (measured on the combined text), so 0081's count reads 1,491 to 1,499.
5. `@keel/server`: this RFC re-bases the budget to 16 kB with S2's, S3's and S4's growth inside it (Token impact), so 0081's "about 180 B left for RFC 0080" becomes "inside RFC 0080's re-base".
6. Codes and ADRs: E2500-E2599 are this RFC's and E2600-E2749 stay 0081's. This RFC's ADRs are 0073 to 0079, so 0081's start at 0080.

### 5. Topology split
**Placement.** `topology.ts` keeps its shape, `topology({ <name>: { modules, adapter } })`. A module (app or stdlib) is in one deployable (E1552). Nothing else names a deployable: the generated entry is built per deployable, `createApp` gets its name from the entry, and app code never reads it.

**Route table.** The generated entry imports each of its app modules' `routes` (`modules/<id>/routes.ts`; a stdlib module's routes arrive through an app module's spread, as `apps/sessions` does today) and merges them for `createApp({ routes })`, whose `selectDeployable` already keeps the served deployable's routes. A path served by two deployables is E1559, checked over `routes.json` and `topology.ts`; with S2's k.prefix the check compares the expanded paths. E1552's "module with no route" case becomes "no route and no runner", so a deployable of only jobs is valid.

**Calls.** `service({ module: 'digest', schema: DigestApi })` replaces `service({ base: new URL(url).origin, schema })` for calls between app modules. On a ctx a `createApp` bound (the binding k.module's `stdConfig` already uses), the client resolves the module: the served deployable or an in-process peer answers through its `fetch` with no network; a remote peer answers through `ctx.net.fetch` to `KEEL_PEER_<NAME>`. In a browser the base is the document's origin. On an unbound ctx (unit tests) the base is `http://<module>.keel.invalid`, which `ctx.net.route` can serve under sim. Every path sends the same headers (`accept: application/json`, `x-keel: 1`) and runs the same decode, so the outcome differs between topologies only by `api.network` and `api.timeout`.

**Forwarding.** A `node` deployable that gets a request for a path a peer serves forwards it (method, path, search, headers but `host`, body) and returns the answer unchanged; a request carrying `x-keel-forwarded` is not forwarded again. The table is the app's `routes.json`, which the build copies into `dist/<name>/`. So the browser, a test or a load balancer can use any `node` deployable as the entry and see the whole app, and client deployables keep calling one origin. Forwarding adds no trust: a peer serves the same public routes a client could reach directly, and the peer runs its own same-site check against the shared public `origin`.

**Production entry.** `keel build` bundles, per `node` deployable, a generated entry (a virtual module of the compiler plugin, never written as a source file) into `dist/<name>/server.mjs` with every dependency included:
```ts
// virtual:keel/server/api (topology { api: [api], digest: [digest] })
import { start } from '@keel/server/start'
import topology from '/topology.ts'
import { routes as api } from '/modules/api/routes.ts'
start({ topology, deployable: 'api', routes: [api], runners: {} })
```
`start` parses `process.env` with `DeployEnv` (`PORT`, `KEEL_ORIGIN`, `KEEL_SECRET`, `KEEL_PEER_<NAME>` per other `node` deployable), prints one E1560 and exits 1 on a failure (naming the key, never the value), then serves `createApp` with `@hono/node-server`, and on SIGTERM or SIGINT stops listening, awaits `close()` and exits 0. `@keel/server/start` is a new node-only export of the kernel package, so the browser and `createApp` budgets carry none of it. The entry is the only code that reads `process.env`, as `server.ts` is today. `KEEL_SECRET` is one value for all of an app's deployables, so `caller` is the same hash wherever a request lands (D4).

**Local topology.** `keel dev` runs every deployable in one process on one origin. The compiler plugin's dev server serves `client` and `static` entries through Vite with HMR, and creates one dev `createApp` per `node` deployable through Vite's SSR loader, each with its own real `ctx` (storage in `.keel-dev/storage`, which the scaffold git-ignores), its runners, and the others as in-process peers. A request goes to the deployable whose route table holds its path. The Vite proxy the golden apps configure for `/api` is then unnecessary and is removed (Migration).

**Tests.** A test serves a split in one process with `createApp` per deployable and `peers` set to the other apps, under sim ctxs; the harness needs no new API.

### 6. Generated Docker and CI
One pure generator in `@keel/scaffold`, `deployFiles(topology, project)`, returns the deploy files; three callers use it (default 3):

- `keel build` writes them beside the build, as it writes `.keel/` artifacts;
- the scaffold `project` generator and every operation that adds, removes or moves a module (`module`, `codemod move`, the new `codemod place`) write them in the same edit set;
- `keel check` regenerates them in memory and reports E1005 on a file that differs, with the regenerated file as its fix (k.compiler already names Dockerfiles and CI workflows among the read-only outputs; the fix makes E1005 actionable for them). In this repository, `tooling/generate.mjs --check` calls the same generator for each app listed in a new `tooling/deploy.source.json` and reports S0007 on drift, so root `pnpm check` covers `apps/golden-1`.

Generated, per project:

| File | When | Content |
| --- | --- | --- |
| `deploy/<name>/Dockerfile` | each `node` deployable | `FROM node:22-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d` (D3; the digest is part of the generator and moves with Keel releases); `WORKDIR /app`; `COPY dist/<name>/ ./`; `USER node`; `VOLUME /data`; `EXPOSE 8080`; `CMD ["node", "--experimental-webstorage", "--localstorage-file=/data/storage", "--disable-warning=ExperimentalWarning", "server.mjs"]`. Build context: the project root. |
| `deploy/compose.yaml` | at least one `node` deployable | one service and one named volume per `node` deployable; `KEEL_PEER_<NAME>: http://<name>:8080` for each peer; `KEEL_ORIGIN` and `KEEL_SECRET` passed from the environment (`${KEEL_SECRET:?}`), never written. |
| `.github/workflows/ci.yml` | projects outside the Keel monorepo (as today) | a job per deployable with `paths` filters over its modules plus the shared files (`package.json`, lockfile, `topology.ts`, `tokens.ts`, `vite.config.ts`); steps: SHA-pinned checkout and setup (the repo's own pattern), install, `keel check --base` with the base branch's `.keel/surface.json`, `keel test`, `keel build`, `docker build -f deploy/<name>/Dockerfile .` for `node` deployables, never pushed; a `client` or `static` deployable uploads `dist/<name>` as a workflow artifact. |

The CI job for `--base` reads the base surface with `git show "origin/$BASE_REF:.keel/surface.json"` after a checkout with enough history; on a first commit the file is absent and the step runs without `--base`.

**What a person configures, and where.** Runtime values only, in the environment where the image runs, validated by `DeployEnv` at start (principle 4: the schema is the declaration, E1560 the diagnostic). Nothing in the generated files is edited by hand. Build-time settings (another base image, a registry, more replicas) are not configurable in S3; each would be a schema-declared field of a deployable in `topology.ts` added by a later RFC, so `topology.ts` stays the one place a deployment is described.

**Where backlog 0305 fits.** 0305 asks whether a production server serves all of `public/`. It decides what a `node` deployable's image serves besides `/assets/*` and `/keel-mark.svg`, and whether a `client` deployable's build (its `index.html` and `public/`) can be served by a `node` deployable's image instead of a separate static host. S3 does not decide it: the generator writes no image for `client` or `static` deployables, and the CI uploads their build. Once the user answers 0305, the deploy lane's generator is the one place the answer lands.

### 7. Compat check
**What it compares.** `.keel/surface.json` (a k.compiler artifact, written by `keel build`): every route's `module`, `path`, `params`, `search`, GET answer and per-method action `input` and answer; every `service({ module })` call's calling module and endpoint schemas. The build evaluates `routes.ts` (as for `routes.json`) and each `endpoints` file a `service({ module })` names, so `keel check` stays static (it reads the artifact; a stale one is E1005).

**The relation.** `accepts(A, B)`: every value `B` admits parses with `A`, decided structurally on k.schema kinds (spec text in k.compat). It is conservative: when it cannot decide, it reports.

**The rules.**
- **E1561** (in the tree, every topology): an endpoint of `service({ module: m })` whose request `m`'s route does not accept, or whose `output`/`errors` do not accept the route's answer. No fix: the remedy is to use the producer's schema, which the message names, and choosing between a consumer's and a producer's intent is a judgment.
- **E1562** (with `keel check --base <surface.json>`): for each base endpoint whose caller and producer sit in different deployables now, the current route must still accept the base caller's request, and the base caller's `output` must accept the current answer. Callers deployed with the producer ship together and are skipped, so the same change can be clean in one topology and E1562 in another: that is the point of the rule. Fix when the change is one added required object field: make it optional (the common additive change). Removed or narrowed output fields have no fix.

Example: `digest` adds a required `since` to the input of `POST /digest/refresh` while `api`, in another deployable, still sends `{}`:
```
E1562 modules/digest/RefreshInput.schema.ts:4:3 api.refresh (base) sends no since; digest.refresh requires it
  fix: -  since: s.number(),
       +  since: s.number().optional(),
```

### 8. Exit proof: golden-1, one deployable and two
The proof extends `evals/tasks/golden-1-api` (default 3): its TASK.md gains the `digest` module and drops `server.ts`, its hidden acceptance test gains the in-process split comparison, and its `pass.ts` gains the built-process comparison. `pnpm eval --task golden-1-api --runner none --strict` is the exit proof, and an agent build is held to the same bar.

**golden-1 changes** (D2). A new module `digest` (`deps: ['api', 'todos', '@keel/std-jobs', '@keel/std-schedules']`, capabilities `clock`, `random`, `storage`, `net`):
- `Digest.schema.ts` `{ open: s.int(), done: s.int(), at: s.number() }`; store `digest.latest` in `digestStores.ts`.
- Job `digest.recount` (`recount.server.ts`): reads the board through `service({ module: 'api', schema: BoardEndpoints })` (`GET /api/lists`), counts open and done todos, saves `digest.latest` with `at` the clock's time.
- `jobs.server.ts`, `schedules.server.ts` (`digest.hourly`, `0 * * * *`, `UTC`, job `digest.recount`), `runners.server.ts` (`[jobs, schedules]`).
- Routes: `digest.show` `GET /digest` (loader of `digest.latest`), `digest.refresh` `POST /digest/refresh` (action: `jobs.enqueue(ctx, 'digest.recount', {}, { key: 'recount' })`), `digest.feed` `GET /digest/feed` (a live loader that yields the current digest, then re-reads it through `service({ module: 'digest' })` every 1,000 ms of `ctx.clock` and yields when `at` changes; S4's std.channels replaces the polling with a push).
- `api/module.ts` lists `api.lists` in `public.routes`. `server.ts` is deleted; the `api` script runs `dist/api/server.mjs`; `vite.config.ts` loses its proxy (`keel dev` serves `api` and `digest`).

Topology A: `{ web: { modules: ['todos'], adapter: 'client' }, api: { modules: ['api', 'digest'], adapter: 'node' } }`. Topology B: the same `web`, `api: { modules: ['api'] }`, `digest: { modules: ['digest'] }`, both `node`. The repository commits A.

**In process (hidden acceptance test, sim).** For A and B, serve the `node` deployables with `createApp` (peers in process, sim ctx seed 1 per deployable) and run one script through `api`: add a list and three todos, toggle one, `POST /digest/refresh`, advance the clock 1 s, `GET /digest`, open `GET /digest/feed` (event stream) and read, advance to the next full hour (the schedule fires), read the feed, then `close()` the deployable holding `digest` while `digest.recount` waits on its `api` call and start it again on the same ctx. Assertions:
- the two transcripts (status, body, each event's `data`, final `digest.latest` and `api.board` states) are equal after ids are replaced by their first-appearance index (`ctx.random` streams differ when two modules share one ctx);
- `GET /digest` is `{ open: 2, done: 1 }` after the refresh and after the scheduled run;
- in B every `/digest` request reaches `digest` through forwarding, and `digest.recount`'s board read reaches `api` through the peer;
- after the restart, `digest.recount` ran once more and no job was lost: the queue is empty and `digest.latest` is current.

**Built processes (`pass.ts`).**
1. Copy `apps/golden-1` twice into a temporary workspace; write topology B into the second copy. Assert `diff -r` over everything but `dist/`, `deploy/`, `.keel/`, `node_modules/` reports `topology.ts` alone.
2. `keel build` in each; `keel check` is clean in each (no E1005, E1559, E1561). A has `deploy/api/Dockerfile` and no other Dockerfile; B has `deploy/api/Dockerfile` and `deploy/digest/Dockerfile`; `compose.yaml` has one service in A and two in B, B's with `KEEL_PEER_API` and `KEEL_PEER_DIGEST`.
3. Start the `node` deployables of each copy with `node --experimental-webstorage --localstorage-file=<tmp> dist/<name>/server.mjs`, one `KEEL_SECRET`, `KEEL_ORIGIN` the entry's URL, free ports, B's peers by URL. Run the HTTP script of the in-process test without clock control against each copy's `api` port (the refresh is polled until `GET /digest` changes, at most 5 s; the feed is read until one event after the refresh).
4. Assert the normalized transcripts equal; a SIGTERM stops every process with exit code 0 within 10 s; restarting B's `digest` on the same storage file answers the same `GET /digest`.
5. With `KEEL_SECRET` unset, `node dist/api/server.mjs` exits 1 and its output is one E1560 line naming `KEEL_SECRET`.

Docker is not run by the eval (it is not a dependency of the repository's tooling); the image build runs in the generated CI and in this repository's golden-1 job (D3).

### 9. What S3 reuses from S2
- k.server's room: 0079 moves the head into k.head, which takes k.server from 1,500 to 1,462 tokens; S3 spends it on K2.
- `temporal.TimeZone` (std.temporal) types a schedule's `zone`, and E1758 keeps app code off host-zone reads, so a schedule's zone is always explicit.
- The `./tools` pattern for stdlib rules (std-i18n, std-messages) is the pattern std-jobs and std-schedules follow.
- k.prefix: E1559 compares paths after the implied prefix expands, so a prefixed route and its unprefixed form in two deployables collide.
- The S2 kernel lane edits `packages/server` (guard redirect params, 308, head); S3's kernel lane starts from that state. The S2 golden-2 lane edits `apps/golden-2`; S3 touches only its `server.ts`, `package.json`, `README.md` and `vite.config.ts` afterwards.

## Alternatives
- **Keep a hand-written `server.ts` per deployable.** Each split edits it, which is the source change the exit forbids, and every app repeats the same twenty lines (principle 7).
- **One hand-written generic entry reading `KEEL_DEPLOYABLE`.** No source change, but the bundle of every deployable would hold every module's server code, and the entry would be app code an agent must keep in step with the kernel.
- **Keep `service({ base })` for calls between modules, with forwarding alone.** No API change, and golden apps keep working, but a call from `api` to `digest` would leave the process even when both share it, the base would be whatever host the request came in on, and the compat rule would have to guess the producer from a path. `module` names the producer, so k.module and k.compat check it.
- **A shared front proxy (Caddy or nginx in compose) instead of forwarding.** A third-party image and its config in the generated files (an external integration), and the dev topology would need a second router. Forwarding is about 40 lines in `createApp` and works the same in dev, tests and production.
- **Request forwarding left out; one origin per deployable.** A client deployable and a link between modules in two deployables would need two origins and cross-origin writes, which k.server's same-site proof refuses.
- **Jobs as routes** (`routes.jobs({...})`), or a job table inside `routes.ts`. k.router is at 1,499 tokens after S2, `routes.ts` is evaluated at build time and shipped to clients for links, and a job is not an HTTP surface.
- **A `process` capability on `ctx`** with start, stop and a signal. One process lifecycle per `ctx`, while runners need one signal each; k.ctx has 11 tokens of room; `clock.after` already schedules under sim.
- **A stdlib-registered file convention** (a package's `./tools` declares `jobs.server.ts` and the build imports it). A file starts running because a package said so, which is action at a distance (principle 2); `runners.server.ts` is the one place a module says what it runs, and E2504/E2553 catch a queue or schedule missing from it.
- **A Redis or SQL queue (BullMQ and the like).** An external service, no sim implementation, and a second storage path beside `ctx.storage`. A shared store is S8's std-db; the queue moves onto it then without an API change.
- **Exactly-once jobs.** Needs a transaction spanning the job's effects and the queue; at least once with `key` and idempotent `fn` is what `ctx.storage` can promise.
- **Enqueue staged until the action's store save commits.** It would couple std-jobs to the k.server save path (a kernel hook for one package). Kept as a Known limit; `key` covers the retry case.
- **A cron library** (cron-parser, croner). They accept wider dialects (seconds, `L`, `W`, `#`, names, macros) that E2551 would refuse anyway, and compute from `Date` in the host zone or their own timers; Keel computes on `ctx.clock` time in an explicit zone through `Intl`, and the check rule needs the parser in `./tools`.
- **UTC-only schedules.** Simpler, but "every day at 03:00 in Berlin" is the common case and S2 already brings `TimeZone`.
- **`EventSource` for streams.** Absent on Node 22 and 24 without a flag, cannot send `x-keel` or `accept`, bypasses `ctx.net` (no sim), and E1601 refuses it in app code. Fetch with a streaming body and `TextDecoderStream` exist on both runtimes and in every browser Keel targets; the SSE framing is about 60 lines.
- **WebSockets for streams.** Two-way channels are S4's std-channels; a one-way stream over plain HTTP passes proxies, guards and the same-site proof unchanged.
- **Streams as a new route field or a `stream()` server function.** k.router has no room, and a second server-function kind beside `loader` is a second way to read data (principle 1). A live loader is a loader whose first yield is its ordinary answer.
- **A `@keel/std-streams` package with topics, replay by id and reconnect** (this RFC's draft). RFC 0081's std.channels keeps its own fan-out, declines resume and sets its own backoff, so each would be a second way (D5).
- **A kernel cap on open streams.** A cap is policy that depends on who may open a stream; std.channels' config holds it.
- **Compat by equal schemas.** Any change would fail, including additive ones; `accepts` allows what an older caller can still parse.
- **Compat against git history inside the rule.** Rules are pure with no I/O; `--base` hands the old artifact in, and the generated CI fetches it.
- **Splitting k.server along Build and Dev server (with their clauses)** instead of moving only Topology. It would change five conformance headers; moving the Topology paragraph changes none.
- **Per-deployable secrets.** `caller` would differ by deployable, so undo scoping and stored `tx` meta would change when a module moves: a split would change values.
- **Generating images for `client` and `static` deployables now** (nginx or a Node static server). It decides backlog 0305 by the back door.

## Spec diff
Token counts are `ceil(length / 4)`, the rule `tooling/budgets.mjs` uses, measured by applying these edits to copies of the sections (k.server after RFC 0079's edit). Appended clauses keep every existing clause number; no existing clause text changes. Trims remove citations only, which CLAUDE.md rule 11 asks for anyway, or say the same thing in fewer words.

### k.server (1,462 after RFC 0079, to 1,491; 1,499 with RFC 0081's edit)
- API: after the `params`/`search` bullet, "- A loader whose `fn` is an async generator is live (E1558): a document or JSON GET takes its first yield, an event-stream GET all; args add `signal`."
- Request flow: after the GET bullet, "- GET with `accept: text/event-stream` to a live loader's route: guard denial 403 `keel.denied`, else a `data:` line per yield (its `Result` JSON), a `:` line per 15 s of `ctx.clock`, until `fn` returns or `signal` aborts (request abort, `close()`). Other routes: 406."
- Topology: the paragraph moves to k.topology.
- Build: "`keel build` bundles each `node` deployable's entry and islands to `dist/<name>/` (`.vite/manifest.json`). Production `createApp({ assets: 'dist/<name>' })` loads it at startup" becomes "Builds, runners, peers, `keel dev`: k.topology. Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup".
- Dev server: "`keel dev`: Vite and Hono, one process, HMR, real `ctx`." moves to k.topology (Local topology); the paragraph is renamed **Log.**
- Rules: E1552 and E1553 move to k.topology; append "· E1558 a live loader a non-`node` deployable serves."
- Conformance, appended: "An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a document GET renders `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403."
- `createApp({ origin })` is specified in k.topology (Build), beside `KEEL_ORIGIN`.

Full text after the change:
~~~md
# k.server: Thin server
status: conformance-covered

**API.** Apps import only `topology` from `@keel/server`; `loader`/`action` (`@keel/router`) run over HTTP.
- `loader({ output, params?, search?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, stores }` and `ctx`; returns `Promise<Result<T, KeelError>>` encoded with `output`.
- `action({ input, params?, stores? }, fn)`: `fn` gets the decoded input, `{ params, url, caller, stores }` and `ctx`; returns `Result<Href | null, KeelError>`; routes bind it by method (`routes.actions`, k.router).
- `params`/`search` are `Infer` of the declared schemas (else `unknown`), the route's own (E1507); `fn` is never annotated; `url` is absolute.
- A loader whose `fn` is an async generator is live (E1558): a document or JSON GET takes its first yield, an event-stream GET all; args add `signal`.

**Server state.** `stores` names a factory `(ctx) => S` of stores (explicit `id`s) and transactions. Per request each named factory runs once, restoring its stores from `ctx.storage` `keel.store.<id>`; `fn` gets `S`. An action's `ok` saves its changed stores unless another request saved any of the factory's since (409 `keel.conflict`); `err` or a throw saves none. `caller` is the base64url SHA-256 of the cookie token, HMAC-signed with `createApp({ secret })` (<32 bytes: E1556; default per process, W1556 in production); `tx` meta `{ caller }` scopes `undoWhere`. The cookie (`HttpOnly; SameSite=Lax; Path=/`) is `__Host-keel-caller`, `Secure` on https (`createApp({ secure })`; default the URL's or `x-forwarded-proto`, W1557 in production), else `keel-caller`. Factory stores skip `#k-state` and inspect; server code never writes module stores; client routers refuse `stores`.

**Request flow.** Match routes -> parse params (fail: 404) and search (fail: defaults) -> guard (deny: redirect) ->
- GET: run the chain's loaders concurrently, then stream HTML. A loader `err` renders the route's `errorElement`.
- GET with `accept: text/event-stream` to a live loader's route: guard denial 403 `keel.denied`, else a `data:` line per yield (its `Result` JSON), a `:` line per 15 s of `ctx.clock`, until `fn` returns or `signal` aborts (request abort, `close()`). Other routes: 406.
- POST, PUT, PATCH, DELETE: first the same-site check (`Sec-Fetch-Site` `same-origin`/`none`, its own `Origin`, `accept: application/json` with `x-keel: 1`, or neither; else 403 `keel.denied`, nothing runs). `_method` overrides POST only. A body over `createApp({ maxBodyBytes })` (default 1 MiB) is `keel.payloadTooLarge` (`data: { limit }`), nothing runs. Then decode FormData or JSON (empty: `{}`) by `input` (fail: `keel.fields`, not called), run it, 303 to the target (document) or `Result` JSON (runtime).

Status: `keel.notFound` 404 · `keel.denied` 403 · `keel.fields` 422 · `keel.payloadTooLarge` 413 · `keel.conflict` 409 · other `err` 400 · uncaught throw 500 `keel.unexpected` (production: message `unexpected`, no stack). `mode` defaults to `production`. `#k-state` holds every request-scope store.

**Document.** Each route level is a candidate island root by route id. Head, `<html lang>` and the `keel.notFound` alert: k.head.

**Build.** Builds, runners, peers, `keel dev`: k.topology. Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup, scripts its entry, serves `/assets/*` and `/keel-mark.svg` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag); dev, or no `assets` in development/test, serves `/@keel/entry.ts`.

**Log.** Stdout log (OUTPUT.md), a record per event: `req`, `diag` per diagnostic or uncaught throw (app frames only, max 5), `reload`; `createApp({ log: { format: 'compact' | 'json', write } })` gets each line.

**Rules.** E1551 `loader`/`action` outside `*.server.ts` (any deployable) · E1554 loader data fails its output schema (dev diag; production 500) · E1555 production `assets` missing or entry-less · E1558 a live loader a non-`node` deployable serves.

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
- On https the caller cookie is `__Host-keel-caller`; a `keel-caller` there counts as none.
- A save is 409 `keel.conflict` if a store the action only read was saved since; no request sees one store before a save and another after it.
- `createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555.
- Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served.
- Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.
- An event-stream GET of a live loader yielding `ok(1)`, `ok(2)` gets two `data:` lines in order; a document GET renders `ok(1)`; aborting the request aborts `signal`; a denying guard gives 403.
~~~

### spec/kernel/k.topology.md (new, 1,496)
~~~md
# k.topology: Deployables
status: proposed

**Declaration.** `topology.ts` default-exports `topology({ <name>: { modules, adapter } })` (`@keel/server`), read statically. Adapters: `node` (Hono; serves the resume entry), `static` (prerendered HTML), `client` (loaders, actions in the browser; entry `mount(App, el)`, real `ctx`). Each module, app or stdlib, is in one deployable. A module's routes, actions, live loaders and runners run where its deployable does and no other file names a deployable, so moving modules between deployables (split or merge) edits `topology.ts` alone.

**Route table.** A deployable serves its modules' routes: the generated entry merges each module's `routes` (`modules/<id>/routes.ts`) into `createApp({ routes })`. A path has one deployable (E1559).

**Runners.** A module's background work is the `runners` export of `modules/<id>/runners.server.ts`: `Runner`s `{ run(ctx, signal): Promise<void> }` that stdlib packages build (std.jobs, std.schedules). `createApp({ runners: { [moduleId]: Runner[] } })` calls each `run` of the served deployable's modules once, after startup, with the app's `ctx`. A `run` that rejects before `signal` aborts is a `diag` on the log and runs again 1,000 ms later on `ctx.clock`. `app.close()` aborts each runner's `signal` and open event stream and resolves when every `run` has settled.

**Calls and peers.** A module calls another's routes through `service({ module })` (k.services), encoded and decoded alike in every topology: a split adds latency and `api.network`/`api.timeout` outcomes, never another value. `createApp({ peers: { [deployable]: URL | ServerApp } })` names the other `node` deployables: URLs in production, apps in one process. A `service({ module })` request is answered in process when its module is here or in an in-process peer, else by the peer's URL. A request for a path a peer serves (by `routes.json` in `artifacts`) is forwarded to it: method, path, search, headers but `host`, body; its response is returned unchanged; one carrying `x-keel-forwarded` is not forwarded again.

**Build.** `keel build` writes per `node` deployable `dist/<name>/`: the client build (k.server), `routes.json`, `std.json`, and `server.mjs`, the generated entry with every dependency bundled. `node server.mjs` parses `process.env` with `DeployEnv`: `PORT` (default 8080), `KEEL_ORIGIN` (`createApp({ origin })`, the public origin, which replaces the request's in `url`, the same-site check and `Secure`), `KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees), and `KEEL_PEER_<NAME>` for each other `node` deployable. A failure prints one E1560 naming the key, never a value, and exits 1. Then it serves `createApp` (production, real `ctx`, its routes, runners and peers) and on SIGTERM or SIGINT stops listening, awaits `close()` and exits. `ctx.storage` is the file `--localstorage-file` names, the only state that survives a restart.

**Deploy files.** Derived from `topology.ts` by one generator (`@keel/scaffold`), written by `keel build` and by scaffold operations that change modules or deployables; read-only (E1005, fix: the regenerated file).
- `deploy/<name>/Dockerfile` per `node` deployable: `node:22-slim` by digest, `dist/<name>/` only, user `node`, volume `/data` for storage, port 8080.
- `deploy/compose.yaml`: a service and volume per `node` deployable, `KEEL_PEER_<NAME>` set to peers' service URLs, other `DeployEnv` keys from the environment.
- `.github/workflows/ci.yml` (outside the Keel repo): a job per deployable, run when its modules or shared config change: install, `keel check --base` the base branch's surface (k.compat), `keel test`, `keel build`, an unpushed image build per `node` deployable.
`DeployEnv` values are set where the image runs, never in a generated file.

**Local topology.** `keel dev` serves every deployable in one process on one origin: Vite serves `client` and `static` entries with HMR; each `node` deployable runs its dev `createApp` (real `ctx`, storage in `.keel-dev/`) and runners, the others its in-process peers, and serves its paths.

**Rules.** E1552 a topology module unknown or in two deployables · E1553 `static` deployable route with params or actions · E1559 one path in two deployables (names both routes) · E1560 the production environment fails `DeployEnv` (at startup).

**Conformance.**
- Fixture modules `a` (its loader calls `service({ module: 'b' })`) and `b` (a runner), served in one process as `{ one: [a, b] }` and as `{ x: [a], y: [b] }` under sim ctxs of one seed: a generated request script through `one` and through `x` gets equal statuses, bodies and final store states.
- `x` answers a path of `b` with `y`'s status, headers and body; one carrying `x-keel-forwarded` is not forwarded.
- With `a` and `b` in one deployable a `service({ module: 'b' })` call makes no `ctx.net.fetch`; with `y` at `http://y.test` it makes one, to that URL.
- `createApp({ runners })` runs each runner of the served deployable once, none of another; `close()` aborts their signals and resolves once each `run` settles; a rejected `run` runs again 1,000 ms later on the sim clock.
- `node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value.
- With `node` deployables `x`, `y` and a `client` one, `keel build` writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile; a changed byte is E1005 whose fix restores it; moving `b` from `y` to `x` changes only `topology.ts`, `deploy/` and the CI workflow.
- Two routes with path `/p` in modules of different deployables are one E1559.
- With `origin` `https://a.example`, a POST with that `Origin` to another host passes the same-site check, and the caller cookie is `__Host-keel-caller`.
- `keel dev` answers a `client` page and a path of each `node` deployable from one process on one origin.
~~~

### k.services (1,198 to 1,482)
- API: endpoint keys gain `events?`; the `service` bullet names `module`; a client method takes `signal?`; a new bullet for `events` endpoints.
- Trims: "(rfc:0034)", "rfc:0039", ", RFC 0022".
- Conformance, appended: the `events` clause and the unbound-ctx clause.

Full text after the change:
~~~md
# k.services: Thin services
status: conformance-covered

**API.**
```ts
// modules/orders/OrdersApi.schema.ts: handwritten, or generated by `keel scaffold service orders --openapi openapi.json`
export const OrdersApi = endpoints({
  getOrder: { method: 'GET', path: '/orders/:id', params: s.object({ id: s.id('Order') }), output: Order },
  addNote: { method: 'POST', path: '/orders/:id/notes', params: s.object({ id: s.id('Order') }),
    body: NoteInput, output: Note, errors: { 409: Conflict } },
})
// modules/orders/api.ts
import { OrdersApi } from './OrdersApi.schema.ts'
export const api = service({ base: 'https://api.example.com', schema: OrdersApi, timeout: 5000 })
// in a loader or action
const r = await api.getOrder({ params: { id } }, ctx) // Result<Order, ApiError>
```
- `endpoints` and `service` come from `@keel/services`. Endpoint keys: `method`, `path`, `params?`, `query?`, `body?`, `output`, `errors?` (status to schema), `timeout?`, `events?`.
- `service({ base, schema, timeout? })` calls another service; `service({ module, schema, timeout? })` calls the routes of app module `module` (k.module `deps` and `public.routes` apply), resolved by k.topology: in process, a peer, or in a browser the document's origin; on a ctx no `createApp` bound, `http://<module>.keel.invalid`. The timeout defaults to 10,000 ms; an endpoint `timeout` overrides it; none is per call.
- A client method takes `{ params?, query?, body?, signal? }` and `ctx`. Requests go through `ctx.net.fetch` (k.ctx), so tests run under sim.
- A GET endpoint with `events: true` is an event stream (a k.server live loader): its method returns an `AsyncIterable` of `Result<T, ApiError>`, sends `accept: text/event-stream` and decodes each `data:` line, a k.server `Result`: an `ok` value with `output`, an `err` as `api.status` (200, `body` the error). It ends when the stream ends, after an `err`, or when `signal` aborts; it never reconnects or resumes, so a caller that reopens picks its own backoff. Its timeout applies until the response starts.

**ApiError.** A union of KeelErrors (k.errors), matched on `code`:
- `api.timeout` `{ ms }`: no response within the timeout, measured on `ctx.clock`; the request is aborted.
- `api.network` `{}`: `fetch` rejected.
- `api.status` `{ status, body }`: non-2xx; `body` decoded by `errors[status]` when declared, else `null`.
- `api.decode` `{ issues }`: a 2xx body that fails `output`.
- `api.input` `{ issues }`: the call's `params`, `query`, or `body` fail their schemas; nothing is sent.

The client never throws; every failure is an `err`.

**Encoding.** Path params are URL-encoded; `query` is encoded by its schema; `body` is JSON by its schema. Every request sends `accept: application/json` and `x-keel: 1` (the k.server same-site proof). Responses decode with `output`.

**OpenAPI**. `openapi(doc, { name })` from `@keel/services/openapi` (build time; `keel scaffold service` writes its output) returns `Result<{ schema, service }, SchemaError>`: the sources of `<Name>Api.schema.ts` (`<Name>Api = endpoints({...})`, one endpoint per operation keyed by its `operationId`, in document order) and `api.ts` (`api = service({ base: servers[0].url, schema })`, importing `./<Name>Api.schema.ts`). Each file's name equals its one export (principle 3, E1752). From OpenAPI 3 JSON: `{name}` path segments become `:name`; `path` and `query` parameters become `params` and `query` objects (query fields optional unless `required`); a JSON request body is `body`; the lowest 2xx JSON response is `output` (none: `s.json()`); every other numeric status with a JSON body is in `errors`. Schemas: `string` (`minLength`/`maxLength`), `integer` and `number` (`minimum`/`maximum`), `boolean`, `array`, `object` (keys outside `required` optional; `additionalProperties: false` closes it; `additionalProperties` alone is `record`), string `enum`, `const`, `nullable: true` or `type: [T, 'null']`, `oneOf`/`anyOf` (member union), local refs (`#/components/schemas/<Name>` becomes a file-local `const <Name>`, others are inlined); anything else is `s.json()`. A doc outside this subset (no `paths`, a missing or non-identifier `operationId`, a missing or relative server URL, a cyclic ref) is `err`, with issue paths into the doc.

**Not here** (stdlib): retries, caching, auth and token refresh, interceptors.

**Rules.** On `endpoints({...})` literals from `@keel/services` and app code. E1651 `ctx.net.fetch` in app code (no fix; declare an endpoint) · E1652 a `:param` in a literal `path` without a field in a literal `params`, or a `params` field missing from `path` (fix adds or removes the field) · E1653 `body` on a `GET` or `HEAD` endpoint (fix removes it).

**Conformance.**
- A 2xx response whose body matches `output` yields `ok` with the decoded value.
- A 2xx response whose body fails `output` yields `err` with `api.decode`, never `ok`.
- Invalid call input returns `err` `api.input` with issue paths prefixed params/query/body and sends no request.
- Under sim, with no response, advancing the clock to `timeout - 1` leaves the call pending; advancing to `timeout` yields `api.timeout` and aborts the request signal.
- A 409 with `errors: { 409: Conflict }` yields `api.status` with a decoded body; an undeclared 500 yields `api.status` with `body: null`.
- A rejected `fetch` yields `api.network`.
- Param value `a/b` is sent as `a%2Fb`.
- For generated responses of any status and body, no client call throws.
- The client generated from the OpenAPI fixture has one method per operation, with input and output types matching it.
- An `events` endpoint against a live loader yielding `ok(1)` then `ok(2)` iterates exactly those, then ends; a `data:` line failing `output` yields one `api.decode` and ends; an aborted `signal` ends it with no further request.
- On an unbound sim ctx, `service({ module: 'b' })` sends its request to `http://b.keel.invalid` plus the endpoint path.
~~~

### k.module (1,499 to 1,498)
- Manifest: `deps` "may import from or link to" becomes "may import from, link to or call".
- Checks: "imports, `href()` calls, and `uses:` lists" becomes "imports, `href()` calls, `service({ module })` and `uses:` lists".
- Rules: E1152 "import from, or `href()` into," becomes "import from, `href()` or `service` into,"; E1157 "`href()` to a non-public route" becomes "`href()` or `service` to a non-public route".
- Trims: ", `node_modules/@keel/std-<x>/module.ts`" (the package root says it); "No fix edits a file under `node_modules/`." becomes "No fix edits `node_modules/`."
- Its new clause lives in k.compat (k.module has no room); no k.module clause changes.

Full text after the change:
~~~md
# k.module: Module manifest
status: conformance-covered

**Manifest.** All app code lives in modules. A module is a folder `modules/<id>/` with a `module.ts`:
```ts
import { module } from '@keel/compiler'
export default module({
  id: 'orders',
  deps: ['catalog', '@keel/std-auth'],
  capabilities: ['clock', 'net'],
  public: { exports: ['OrderCard', 'Order', 'addItem'], routes: ['orders.show'] },
})
```
- `id`: lowerCamel, equals the folder name; prefixes the module's route ids, store ids, transaction names, and error codes.
- `deps`: app module ids or stdlib package names this module may import from, link to or call. Stdlib modules ship the same manifest (extension point) at the package root; `deps` name the package and its `id` is its prefix.
- `capabilities`: `ctx` capabilities its code may use.
- `std` (optional): this module's config for stdlib packages, `{ '<pkg>': <literal JSON> }`, read statically. Each key is a stdlib package in `deps`. A package that takes config registers its schema under its package name (`s.register('@keel/std-x', Config)`), and the value must parse with it.
- `public.exports`: export names (equal to file names) other modules may import. `public.routes`: route ids other modules may pass to `href()`.

Everything not listed is private. Cross-module imports name the exporting file; there are no barrels.

**Checks.** Cross-module access is checked statically from imports, `href()` calls, `service({ module })` and `uses:` lists, on every build and `keel check`. Manifests are validated by `ModuleSchema`.

**Std config.** Before validating, `keel check` (every surface) and `keel build` import each `@keel/std-*` package in an app module's `deps` once, and its `./tools` export, if any, resolved from the manifest's folder; `check()` itself imports nothing. The build writes `.keel/std.json` (`{ data, hash }`; E1005 in `keel check`), `{ [pkg]: { [moduleId]: config } }` from the `std` entries that pass E1158, `{}` when none. `createApp({ std: '.keel/std.json' })` reads it at startup and binds it to its `ctx`. A package reads it with `stdConfig(ctx, pkg, Config)` (`@keel/compiler/std/stdConfig`): `{ [moduleId]: Config }`, each value parsed with `Config` (fail: throws E1158), `{}` for a ctx no `createApp` bound. Browsers get only client-readable config: packages marked `clientStd(pkg, keys?)` (`@keel/compiler/std/clientStd`; `keys`: only those top-level keys), for the served deployable's modules. An island document's `#k-state` carries it as `std` (absent when empty), bound by the resume entry before resuming (`bindClientStd`); a `client` entry binds it from `std.json`. Other packages and modules read `{}` there.

**Rules.** E1151 import of a non-public export of another module (fix adds it to that module's `public.exports`) · E1152 import from, `href()` or `service` into, a module not in `deps` (fix adds it) · E1153 cycle in module `deps` (message lists the cycle) · E1154 `public` names an export or route that does not exist (fix removes it) · E1155 route id, store id, transaction name, or error code not prefixed by its module id (fix prefixes it) · E1156 `ctx` capability used, or `observe` called, but not in `capabilities` (fix adds it) · E1157 `href()` or `service` to a non-public route of another module (fix adds it to that module's `public.routes`) · E1158 `std` key that is not a stdlib package (`@keel/std-*`) in `deps`, a `std` value that is not literal JSON, or one that fails the schema registered under its package name (message names the issue's path and rule), at `keel check`, `keel build` and `createApp` · E1159 a `@keel/std-*` `deps` entry not named `@keel/std-[a-z0-9-]+`, not found in the manifest's own or ancestor `node_modules`, or throwing on import, at the entry · E1160 `createApp({ std })` file missing, not `{ data, hash }`, or its `hash` not that of its `data`. No fix edits `node_modules/`.

**Conformance.**
- Importing a non-public export of another module reports E1151 at the import; adding it to `public.exports` clears it.
- Importing from a module absent from `deps` reports E1152 even when the export is public.
- Modules `a` and `b` that list each other in `deps` produce one E1153 naming both.
- Using `ctx.net` or calling `observe` in a module whose `capabilities` lack `net` or `observe` reports E1156.
- Changing the signature of a non-public export produces no diagnostic in any other module.
- A route `show` declared in module `orders` without the `orders.` prefix reports E1155.
- A stdlib module's manifest is validated by the same schema and enforced by the same rules as an app module's.
- A `std` key absent from `deps`, or naming an app module, reports E1158, and listing it in `deps` clears it. A `std` value that fails its package's registered schema reports E1158 naming the issue's path; a value that parses is clean.
- With `@keel/std-brands` in a module's `deps`, `keel check` reports E2101 for a lowercase `s.id` brand; a `deps` package that cannot be imported reports E1159 naming it.
- `keel build` writes `.keel/std.json` with each module's `std` config by package and module id; a value failing its package's schema is E1158 naming the path, and nothing is written.
- `stdConfig` returns, for the `ctx` given to `createApp({ std })`, every module's config, equal to its manifest literal, and `{}` for another ctx; a `std.json` failing a registered schema rejects with E1158 naming the path, a hand-edited one with E1160.
- An island document of `createApp({ std })` carries as `std` in `#k-state` the config of `clientStd` packages for the served deployable's modules, and a resumed route component reading `stdConfig` on a ctx `bindClientStd` bound gets the server's value; other packages and modules, and a `createApp` without `std`, add nothing.
- With `clientStd(pkg, ['a'])`, `#k-state` holds only key `a` of each module's `pkg` config.
- `keel check` imports a `deps` package's `./tools` export: a rule it registers reports, and a throw is E1159.
~~~

### spec/kernel/k.compat.md (new, 889)
~~~md
# k.compat: Surface compatibility
status: proposed

**Purpose.** Deployables ship at different times, so a module's routes must keep accepting what its callers in other deployables send, and keep answering what they decode. `keel check` proves both from one artifact.

**Surface.** `keel build` writes `.keel/surface.json`, a k.compiler artifact (E1005): for each route of the app its `module`, `path`, `params`, `search`, its GET answer (`{ id, results }` of its chain's loader `output`s, k.server) and, per action method, its `input` and answer (`Result` of `Href | null`); for each `service({ module })` call its calling module, `module`, and each endpoint's method, `path`, `params`, `query`, `body`, `output` and `errors`. Schemas are JSON Schema, as in `routes.json`. To read them, the build evaluates `routes.ts` (k.compiler) and each file whose `endpoints` a `service({ module })` names.

**Accepts.** Schema `A` accepts `B` when every value `B` admits parses with `A`, decided on the schema kinds: an object accepts one whose required fields include every field it requires, whose fields it accepts field by field, and, when it is closed, one that is closed too with no other field; a literal or enum one whose values it holds; a number or string one whose bounds lie inside its own; an array one whose items it accepts; a union one whose every member some member accepts; a nullable or optional one when it accepts the inner schema; a format type one of its name; `s.json()` accepts any.

**Endpoints.** An endpoint of `service({ module: m })` matches the route of `m` with its `path` and method (GET: the loader; others: `routes.actions`). The route's `params`, `search` and `input` must accept the endpoint's `params`, `query` and `body`, and the endpoint's `output` and `errors` must accept the route's answer (E1561).

**Base.** `keel check --base <file>` reads another `surface.json`, the one of the deployed code (the generated CI takes the base branch's). For each base endpoint whose calling module and `m` are in different deployables now, the current route must accept the base endpoint's request, and the base endpoint's `output` must accept the current answer (E1562). Modules in one deployable ship together and are not compared. Without `--base`, no E1562.

**Rules.** E1561 an endpoint of `service({ module })` that no route of that module at its method and path accepts, or whose `output` or `errors` refuse the route's answer, at the endpoint, naming the first refused path; no fix · E1562 a route change that a base endpoint in another deployable refuses, at the route's schema, naming the endpoint; fix when the change is one added required object field: make it optional.

**Conformance.**
- For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.
- An endpoint whose `body` lacks a field the route's `input` requires is one E1561; the same endpoint with the route's own schema has none.
- With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none.
- Removing an output field a base endpoint requires is one E1562 with no fix; adding a field to an open output object is none.
- `keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005.
- A `service({ module: 'b' })` endpoint in module `a` reports E1152 without `b` in `deps` and E1157 for a route not in `b`'s `public.routes`.
~~~

### k.scaffold (1,007 to 1,117)
- The command block gains `keel codemod place digest --to jobs --adapter node`.
- Generators, `project`: "generated turbo and CI" becomes "generated turbo, CI and deploy files (k.topology)"; trim "(rfc:0068)".
- Codemods: a `place` bullet.
- Turbo emission: "regenerates `turbo.json` and CI workflows from the task graph (ADR-0009)" becomes "regenerates `turbo.json`, CI workflows and deploy files (k.topology) from the task graph and topology (ADR-0009)".
- Conformance, appended: the `place` round trip.

Full text after the change:
~~~md
# k.scaffold: Scaffold and codemods
status: conformance-covered

**Operations.** Every structural edit is one operation. It computes a complete edit set from the project's artifacts (`.keel/ids.json`, `routes.json`, `deps.json`, module manifests), never from text search, and applies it atomically: all files or none. The same operations are MCP tools (k.cli). `--dry-run` prints the edit set as unified diffs and writes nothing. An edit set is `{ files, created, changed, removed }`: the tree after the operation and the sorted paths it creates, changes, and deletes; a dry run returns the same edit set.
```sh
keel scaffold project shop
keel scaffold module orders
keel scaffold route orders.show --path /orders/:id
keel scaffold component orders/OrderCard
keel scaffold store orders.cart
keel scaffold transaction orders.cart.addItem
keel scaffold service orders --openapi openapi.json
keel codemod rename OrderCard OrderTile
keel codemod move OrderCard --to catalog
keel codemod add-field Order note 'string.optional'
keel codemod place digest --to jobs --adapter node
```

**Generators.** Each emits spec-conformant files only:
- `project`: `package.json`, `tokens.ts`, `topology.ts` (`--adapter client|node|static`, default `client`), `vite.config.ts`, module `app`, generated turbo, CI and deploy files (k.topology); `--workspace` (an app inside the Keel monorepo) adds `index.html` and `vitest.config.ts` instead of turbo and CI. `keel scaffold project <name>` writes under `<name>/`.
- `module`: `modules/<id>/module.ts` and `routes.ts`; adds the module to `topology.ts`.
- `route`: manifest entry, `*.server.ts` loader, page component, route test.
- `component`: `<Name>.tsx` with a `Props` schema and a property test (k.testing).
- `store` / `transaction`: `*.schema.ts`, store or transaction file, invariant test.
- `service`: endpoint schemas from OpenAPI and the service file (k.services): `modules/<id>/<Id>Api.schema.ts` and `api.ts`; schemas are generated, read-only.

**Codemods.**
- `rename` (component, route, store, transaction, schema, field, module) updates the declaration, file name, every import, `href()` call (free or a manifest's `routes.href()`), `uses:` list, element-id prefix, test, and manifest entry.
- `move` relocates a file to another module, updating imports and both manifests.
- `place` moves a module to a deployable in `topology.ts` (a new deployable needs `--adapter`; an emptied one is removed) and regenerates the deploy files; nothing else changes.
- `add-field` adds a field to a schema and to every initial state, fixture, and form `initial` that constructs it. Optional fields need no data; required fields take `--default`.

**Turbo emission.** Any operation that adds or removes a module or package regenerates `turbo.json`, CI workflows and deploy files (k.topology) from the task graph and topology (ADR-0009). Generated files are read-only (E1005).

**Guarantee.** If `keel check` was clean before an operation, it is clean after. Otherwise nothing is written and E1353 reports the first diagnostic the edit set would introduce.

**Rules.** E1351 target id already exists (fix: use a codemod) · E1352 id violates naming: route, store, and transaction ids are dotted lowerCamel segments prefixed by the module id; components PascalCase · E1353 operation aborted, would break check; nothing written · E1354 `add-field` of a required field without `--default` while constructors exist. Input that fails the operation's schema, an unknown target, or a missing `topology.ts` reports k.cli E1052; an unknown operation E1051.

**Conformance.**
- Each generator run in a fresh project leaves `keel check` and `keel test` clean.
- `rename A B` then `rename B A` restores a byte-identical tree.
- After `rename`, no import, `href()` call, `uses:` entry, or element id references the old name.
- `--dry-run` writes nothing and prints exactly the diff a following apply writes.
- An operation whose edit set would introduce a diagnostic writes no file and reports E1353.
- Running the same generator twice reports E1351 the second time and writes nothing.
- After `scaffold module`, `turbo.json` equals the generator's output for the new task graph.
- `keel scaffold project <name>`, with or without `--workspace`, creates every file under `<name>/` and none beside it.
- `place b --to y --adapter node` then `place b --to x` restores a byte-identical tree; neither writes outside `topology.ts`, `deploy/` and CI workflows.
~~~

### spec/std/std.jobs.md (new, 1,028)
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
- **Run.** The runner starts due jobs in `at`, then `id` order, at most `concurrency` at once (module `std` config `{ concurrency }`, 1 to 16, default 1). Before `fn` it stores a lease. `ok` removes the job. `err`, a throw, or no result within `timeoutMs` (then `signal` aborts) counts an attempt: the job waits `min(1000 · 2^(attempt-1), 3600000)` ms on `ctx.clock`, and after `attempts` moves to the newest 100 `failed`, with its error code and no input. Between jobs it waits on `ctx.clock.after` for the next `at` or an `enqueue`.
- **Restart.** Everything above lives in `ctx.storage`, so it survives a restart. A job leased when the process stopped runs again at the next start, counted as an attempt: a job runs at least once, so `fn` must be idempotent. When the runner's `signal` aborts no job starts, and running ones get their `signal` aborted and stay leased.
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
~~~

### spec/std/std.schedules.md (new, 824)
~~~md
# std.schedules: Schedules
status: proposed

**Extension points.** Module manifest (k.module): `@keel/std-schedules` is stdlib module `schedules`; a module that schedules lists it and `@keel/std-jobs` in `deps`, `clock` and `storage` in `capabilities`. Check rule registry (k.check): `@keel/std-schedules/tools` registers E2551-E2553.

**API** (`@keel/std-schedules`; used from `*.server.ts`).
```ts
export const schedules = schedule(jobs, {                           // modules/orders/schedules.server.ts
  'orders.nightly': { cron: '0 3 * * *', zone: 'UTC', job: 'orders.digest', input: {} },
})
export const runners = [jobs, schedules]                             // modules/orders/runners.server.ts
```
- `schedule(queue, table)` is a `Runner` (k.topology). Each entry: `cron`, `zone` (a `temporal.TimeZone`, std.temporal; default `UTC`), `job` (a key of `queue`'s table) and `input` (that job's input type), `missed` (`'once'` default, or `'skip'`).
- `cron` has five fields, minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, Sunday 0); each field is `*`, `n`, `a-b`, a comma list of those, or any of them with `/step`. Names, macros, seconds and `L`, `W`, `#` are not accepted. When both day fields are restricted, a day matching either matches.
- Times are read in `zone` through `Intl.DateTimeFormat`. A local time a clock change skips fires at the first minute after the gap; a repeated local time fires once, at its first occurrence.
- **Run.** At each fire time `t` (a minute on `ctx.clock`) the runner calls `queue.enqueue(ctx, job, input, { key: '<id>@<t>' })`, then stores `t` as the entry's mark in `ctx.storage` key `std.schedules.<module>`. The key makes a fire time enqueue at most one job (std.jobs), also when a crash falls between the two steps.
- **Restart.** The mark survives a restart. At start, if fire times passed since the mark, `'once'` enqueues one job for the latest of them and `'skip'` none; an entry without a mark starts from now. When `signal` aborts, the runner stops waiting.
- A schedule enqueues only its own module's jobs, so it runs in that module's deployable.

**Rules.** E2551 a `cron` or `zone` literal that does not parse, naming the field (no fix; `schedule` also throws it) · E2552 a `schedule` key not prefixed by its module id, or a `schedule` outside `modules/<id>/schedules.server.ts` (fix prefixes the key) · E2553 a module with `schedules.server.ts` whose `runners` lacks `schedules` (fix adds it).

**Conformance.**
- With `0 3 * * *` in `UTC` and the sim clock at 2026-11-10T02:59Z, one job is enqueued at 03:00Z and the next 24 h later, each with key `<id>@<t>`.
- For generated `cron` values and instants `t`, the next fire time after `t` matches the expression, and no minute strictly between them does (checked by a minute-by-minute scan).
- `30 2 * * *` in `Europe/Berlin` fires at 03:00 local on 2027-03-28 and once at the first 02:30 on 2026-10-25.
- Closed across three fire times then started: `'once'` enqueues one job, for the latest; `'skip'` none; a crash after the enqueue and before the mark gives one job run.
- `60 * * * *`, `* * * *`, `@daily` and `0 0 * * MON` are each one E2551, and `schedule` throws E2551 for each.
- E2552 and E2553 each fire on a fixture and not on its clean twin.
~~~

### spec/00-map.md (orchestrator; 829 after RFC 0081, to about 902)
Assumes RFC 0081's move of the stdlib table to `spec/std/README.md`.
- Code ranges: the E155x owner becomes "k.server, k.topology, k.compat"; add the row "| E250x | std.jobs | E255x | std.schedules |".
- Kernel table, after k.server: "| k.topology | Deployables | proposed | placement, runners, peers, production entry, deploy files, local topology |" and "| k.compat | Surface compatibility | proposed | surface artifact, `accepts`, E1561, E1562 with `--base` |".
- k.server's one line becomes "loaders (live too), actions, dev server, adapters".

### spec/std/README.md (orchestrator)
Two rows for the moved table, and the line "S3 (RFC 0080) adds std.jobs and std.schedules.":
```
| std.jobs | Background jobs | proposed | module manifest and inspector hooks: durable jobs, retry, lease, E2501-E2504 |
| std.schedules | Schedules | proposed | module manifest: cron in a zone, catch-up, E2551-E2553 |
```

## Conformance diff
The conformance-writer of each lane writes these from the accepted spec text, skipped until implementation; each clause is cited verbatim by exactly one file. k.server, k.services, k.module and k.scaffold stay `conformance-covered`, so `keel ledger --diff` reports E1707 for each appended clause until its file lands.

- **Kernel, added.** `packages/server/conformance/live-loader-event-stream.test.ts` (k.server); `packages/server/conformance/topology-{split-equal,forwarding,service-resolution,runners-close,production-entry,e1559-path,origin}.test.ts` (k.topology clauses 1-4, 5, 7, 8); `packages/compiler/conformance/topology-local-dev.test.ts` (k.topology clause 9); `packages/services/conformance/{events-endpoint,module-unbound}.test.ts`.
- **Deploy lane, added.** `packages/scaffold/conformance/deploy-files.test.ts` (k.topology clause 6), `packages/scaffold/conformance/place-round-trip.test.ts` (k.scaffold).
- **Compat lane, added.** `packages/check/conformance/compat-{accepts-property,E1561,E1562-added-field,E1562-removed-output,base-optional,service-access}.test.ts` (k.compat, one per clause).
- **Kernel, unchanged headers.** `packages/server/conformance/e1552-topology-modules.test.ts` and `e1553-static-params.test.ts` cite their rule codes, not clause text; the codes move to k.topology and keep their numbers, so the headers stay. `dev-log-stream.test.ts` quotes a clause whose text is unchanged. No existing conformance header quotes a changed or moved clause, so none needs `rfc:0080`.
- **std-jobs, added.** `delay`, `backoff-failed`, `key-idempotent`, `restart`, `concurrency`, `timeout`, `inspect-no-input`, `rules-e2501-e2504` (`.test.ts` in `packages/std-jobs/conformance/`).
- **std-schedules, added.** `fire-utc`, `next-property`, `zone-gap-overlap`, `restart-missed`, `e2551-invalid`, `rules-e2552-e2553`.
- **Not conformance.** Property tests per package (`test/*.property.test.ts`): `accepts` is reflexive and transitive on generated schemas; a queue under generated enqueue, failure and restart scripts never loses a job and never runs a finished `key` twice; cron next-time is monotonic; an `events` reader over generated yields returns exactly the yielded values; the split transcript equality for generated request scripts (golden-1).

## Lanes
**Orchestrator, before the batch.** Write the accepted spec text into `spec/` (k.topology and k.compat new; k.server, k.services, k.module, k.scaffold edits; the two std sections; `spec/00-map.md`; `spec/std/README.md`); write the ADRs; create `packages/std-jobs` and `std-schedules` in the std-money shape (`package.json` with dependencies and the `./tools` export, `module.ts` at the root, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, empty `src/index.ts`, `conformance/`, `unsafe/`); add `@hono/node-server` to `packages/server/package.json` and the `./start` export; add the two packages to `apps/golden-1/package.json`; set the `tooling/deps.json` order; add the `tooling/budgets.json` entries and re-bases (Token impact); add `.keel-dev/` to the scaffold template's and the root `.gitignore`; run `pnpm install` once, so no lane touches `pnpm-lock.yaml`. Shared files stay with the orchestrator: `spec/**`, `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/THREAT-MODEL.md`, `docs/HANDOFF.md`, `tooling/budgets.json`, `tooling/deps.json`, `tooling/ledger/ledger.json`, `tasks/BACKLOG.md`, `pnpm-lock.yaml`, `evals/results/**`. A lane that finds a defect in its spec text reports it and does not edit `spec/`.

| Lane | Owns (exclusive) | Needs | Verify |
| --- | --- | --- | --- |
| kernel (K1 to K5 runtime) | `packages/server/**`; `packages/services/**`; `packages/router/src/**`; `packages/compiler/**` except `src/internal/surface*.ts`; `packages/testing/src/**`; the kernel conformance files above; kernel changesets | nothing; lands `Runner`, `createApp({ runners })` and `close()` first, then live loaders, then `service({ module })` and peers, then the entry and the local topology | `pnpm --filter @keel/server --filter @keel/services --filter @keel/router --filter @keel/compiler --filter @keel/testing run check`, the same with `run test` |
| std-jobs | `packages/std-jobs/**` | `Runner`, `close()` | `pnpm --filter @keel/std-jobs run check && pnpm --filter @keel/std-jobs run test` |
| std-schedules | `packages/std-schedules/**` | `Runner`; std-jobs' `queue` and `enqueue` | `pnpm --filter @keel/std-schedules run check && pnpm --filter @keel/std-schedules run test` |
| deploy | `packages/scaffold/**`; `packages/cli/**` (deploy file writes and E1005 freshness, `--base` plumbing into the check input, `keel dev` storage flags, the `place` operation); `tooling/generate.mjs`; `tooling/deploy.source.json` (new) | the `start` entry's file layout from the kernel lane (the Dockerfile `CMD`) | `pnpm --filter @keel/scaffold --filter @keel/cli run check && pnpm --filter @keel/scaffold --filter @keel/cli run test && node tooling/generate.mjs --check` |
| compat | `packages/check/**`; `packages/compiler/src/internal/surface*.ts` (the `surface.json` builder; the kernel lane wires it into the artifact list in one line) | the artifact wiring line; `--base` plumbing from the deploy lane | `pnpm --filter @keel/check run check && pnpm --filter @keel/check run test` |
| golden | `apps/golden-1/**`; `apps/golden-2/{server.ts,package.json,README.md,vite.config.ts}`; `apps/sessions/{server.ts,package.json,README.md}`; `evals/tasks/golden-1-api/**`; `tooling/smoke/**` | every lane | `pnpm --filter golden-1 run check && pnpm --filter golden-1 run test && pnpm eval --task golden-1-api --runner none --strict` |

Order: kernel, deploy and compat start at once (deploy and compat write against the spec text and their own fixtures). std-jobs starts when `Runner` and `close()` land (the kernel lane's first commit); std-schedules writes its parser and rules at once and runs its runner tests once std-jobs lands `queue`. golden starts with the `digest` schemas and the eval task and finishes last. That is five implementation agents and one kernel agent, the program's batch budget. Mutation runs (kernel packages, then std packages) go alone after the batch. Batch end: root `pnpm check && pnpm test && pnpm build`, `node tooling/budgets.mjs`, ledger diff, reviewer and red-team.

**Ride-along backlog lines** (only where a lane already owns the package):
- 0273 (kernel lane, `packages/server`): the same-site check behind a TLS proxy; `origin` (K2) is the fix.
- 0274 (kernel lane, `packages/server`): W1557 behind a proxy; with `origin` set, `Secure` follows its scheme and W1557 does not fire. The `apps/sessions` half (an env switch for `secure`) is the golden lane's, since the generated entry sets `origin` from `KEEL_ORIGIN`.
- 0303, the `loadAssets` lead (kernel lane, `packages/server`): guard a failed `realpath(assets)`; the other leads in that line are std-sessions and stay.
- 0304 (kernel lane, `packages/compiler` and `packages/server`): the node build emits CSS and the head links every chunk's CSS; the kernel lane already changes the node build for `server.mjs`.
- 0306 (kernel lane, `packages/server`) and 0291 (compat lane, `packages/check`), if the S2 batch has not closed them.
- 0270 (deploy lane, `packages/cli`): the ledger checks that each code a range clause names appears in a covering test's name, if its fix stays inside `packages/cli`.
- Not riding: 0296 (needs a rule design), 0302 (`packages/std-sessions`, no lane), 0305 (a user decision; Proposal 6 says where its answer lands).

## Migration
- **Kernel callers.** `origin`, `peers`, `runners`, `close()`, live loaders, `service({ module })`, `events`, E1558-E1562 and `@keel/server/start` are additions. `service({ base })` is unchanged and remains the way to call another service. A `createApp` without `origin` behaves as today. E1152 and E1157 now also read `service({ module })`, which no app uses yet, so no diagnostic appears on upgrade. E1552's "deployable naming a module with no route" accepts a module with runners.
- **Apps.** `server.ts` is replaced by the generated entry in every app (default 2): `apps/golden-1` (Proposal 8), `apps/golden-2` (its `api` script runs `dist/api/server.mjs`; `vite.config.ts` loses its proxy), `apps/sessions` (`KEEL_SESSIONS_SECRET` becomes `KEEL_SECRET`, `KEEL_SESSIONS_PORT` becomes `PORT`, `KEEL_ORIGIN` is set; its README's deployment steps change accordingly). `tooling/smoke/persist.mjs` and its README start `dist/api/server.mjs`. Each app gains generated `deploy/` files and `.keel/surface.json`. The nightly sessions workflow is unaffected (it runs the action, not the server).
- **golden-2's calls.** It may keep `service({ base })` for now; moving `recipes` to `service({ module: 'kitchen' })` would make `recipes` depend on `kitchen` while `kitchen` imports `recipes` schemas (E1153), so it waits until the shared schemas move to `kitchen`, a later golden-2 task.
- **Docs.** `docs/ARCHITECTURE.md` gains the stdlib packages and the Borrow vs build rows "Background jobs and schedules: build on `ctx.storage` and `ctx.clock`; no external queue" and "Event streams: borrow Hono `streamSSE` for the writer; build the reader on fetch streams and `TextDecoderStream`; no `EventSource`". `docs/THREAT-MODEL.md` gains: forwarding between deployables (no new trust), the shared `KEEL_SECRET` (D4), `origin`, job inputs stored without secrets, event streams that store nothing. Each new package gets a README in the std-money shape. The `keel` and `keel-api` skills gain: calls between modules use `service({ module })`; background work goes in `runners.server.ts`; a live loader is an async generator, read with an `events: true` endpoint; a split edits `topology.ts` or runs `keel codemod place`.

## Token impact
Sections after the change (measured): k.server 1,491 (from 1,462 after RFC 0079; 1,499 with RFC 0081's edit), k.topology 1,496 (new), k.compat 889 (new), k.services 1,482, k.module 1,498, k.scaffold 1,117, std.jobs 1,028, std.schedules 824; spec map about 902 of 1,200 after RFC 0081 moves the stdlib table to `spec/std/README.md` (829 there, plus about 73 here). k.server (with S4), k.topology, k.module and k.services are within 20 tokens of the cap: the next change to any of them needs a split first. For k.server the seam is the Server state paragraph with its clauses. The widest task here, golden-1's `digest` module, reads k.topology, std.jobs and std.schedules: 3,348 tokens.

Package sizes (gzip; `tooling/budgets.mjs` rule). "Today" is measured on this branch on 2026-11-10, with S2's kernel lane partly landed; "Measured part" is a prototype or an existing dependency bundled the same way; the rest is estimated.

| Package | Today | Measured part | Estimate | `budgets.json` |
| --- | --- | --- | --- | --- |
| `@keel/server` | 14,390 B | SSE writer: Hono `streamSSE`, external to the bundle; a writer and reader prototype is 461 B together | +0.9 kB (runners, `close`, live loaders on `streamSSE`, `origin`, peers and forwarding); with S2's +0.2 kB and S4's +0.08 kB, about 15.6 kB | `14.5kb` is crossed; re-base to `16kb` (16,384 B) with the measured bytes in the commit (default 7), leaving about 0.8 kB |
| `@keel/server/start` | new | `@hono/node-server` bundled is 8,471 B (external here; inside `server.mjs`) | 1.2 kB | `{ "max": "2kb", "platform": "node" }` |
| `@keel/services` | 1,788 B | reader half of the 461 B prototype | +0.45 kB (`module`, `events` reader) | `3kb` holds |
| `@keel/compiler` | 27,099 B | | +1.6 kB (server bundle, local topology, `surface.json`) | `26.5kb` is crossed; re-base to `29kb` |
| `@keel/check` | 34,676 B | | +1.3 kB (E1561, E1562, `accepts`, E1152 and E1157 over `service`) | `34.5kb` is already crossed by S2's lane; re-base to `36.5kb` |
| `@keel/cli` | 19,166 B | | +1 kB | `22kb` holds |
| `@keel/scaffold` | 13,558 B | | +1.5 kB (deploy templates, `place`) | `16kb` holds, with about 1.3 kB left |
| `@keel/router`, `@keel/testing` | 8,431 B, 6,861 B | | types only; +60 B | hold |
| `@keel/std-jobs` / `./tools` | new | | 2.5 kB / 2 kB | `{ "max": "3kb", "platform": "node" }` / `{ "max": "2.5kb", "platform": "node" }` |
| `@keel/std-schedules` / `./tools` | new | five-field parser and next-time search prototype: 695 B | 1.5 kB / 2 kB | `{ "max": "2kb", "platform": "node" }` / `{ "max": "2.5kb", "platform": "node" }` |

The production image of a `node` deployable holds `node:22-slim` and `dist/<name>/`; nothing else is installed in it.

## Known limits
- **One instance per deployable with runners.** `ctx.storage` is a local file, so two replicas of one deployable would each run the queue. The generated compose runs one replica. A shared store (S8 std-db) lifts it without an API change; open event streams reach only their own process, which RFC 0081 states for channels.
- **Enqueue is not part of the action's save.** An action that enqueues and then gets 409 `keel.conflict` leaves the job enqueued; a retried request with the same `key` enqueues nothing new.
- **Version skew in one direction.** E1562 checks that a new producer accepts an old caller. A new caller against an old producer is a deploy-order rule (producers first) that the generated CI does not enforce.
- **App secrets.** `DeployEnv` carries the kernel's keys only; an app that needs its own secret (an API token for another service) has no source for it in the generated entry until a later RFC adds secrets through `ctx`.
- **No registry push, no image for `client` or `static` deployables** (D3, backlog 0305).
- **Streams in a component.** An `events` reader runs in a browser, but binding events to a component is RFC 0081's std.live; S3's consumers are server code, jobs and tests. golden-1's feed polls until std.channels pushes.
- **`keel dev` storage.** The dev deployables share one storage file; keys are module-prefixed, so they do not collide.

## ADRs
Written with this RFC's acceptance:
- `docs/adr/0073-topology-placement-generated-entry.md`: deployables are placed only by `topology.ts` and served by a generated entry (K1).
- `docs/adr/0074-module-calls-peers-forwarding.md`: modules call each other through `service({ module })`; node deployables forward to peers; one `KEEL_SECRET` per app (K4, K5, D4).
- `docs/adr/0075-runners-and-close.md`: runners and `close()` are a deployable's lifecycle (K3).
- `docs/adr/0076-live-loaders-event-streams.md`: live loaders stream over SSE and `events` endpoints read them; fan-out, resume and reconnect are a consumer's (K2, K4, D5).
- `docs/adr/0077-surface-compatibility.md`: surface compatibility from `surface.json`, E1561 and E1562 (K6).
- `docs/adr/0078-generated-deploy-files.md`: Dockerfile, compose and CI per deployable from one scaffold generator; `codemod place` (K7, D3).
- `docs/adr/0079-jobs-and-schedules.md`: jobs run at least once on `ctx.storage`; schedules enqueue with a key (std-jobs, std-schedules).

## Open questions
None. D1 to D4 are the user's answers to the draft's four questions; D5 records the reconciliation with RFC 0081, and Proposal 4 lists what RFC 0081 changes to match.
