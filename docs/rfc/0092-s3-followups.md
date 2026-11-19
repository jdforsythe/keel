# RFC 0092: S3 follow-ups (surface answers, deploy section, stream cap, schedules and jobs rules, module services, resume in tests)

Status: accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC defaults, after the user said to keep working; the user confirms or reverses it (`docs/HANDOFF.md`, pending decisions). For backlog 0339, 0340, 0341, 0342, 0343, 0344, 0346, 0348, 0349, 0350, 0353, 0354, 0360, 0363, 0364, 0368, 0369, 0370, 0371, 0372, 0388. Each decision cites the WORKFLOW RFC default it applies; the points the defaults say to escalate are under Questions.

## Decisions
Group A: spec text and conformance for behavior that exists or has one answer.
- A1 (0341): k.compat states a route's error answer, a KeelError `{ code, message, data }`, which each `errors[status]` must accept; an endpoints file that throws during the build's evaluation is E1006, records no endpoint and fails `keel build`.
- A2 (0343): in dev a `node` deployable's document scripts `/@keel/entry.ts?d=<name>`, the resume entry over that deployable's islands; `/@keel/entry.ts` without `d` stays the `client` deployable's page entry.
- A3 (0348): a rejected runner `run` is a `diag` with code `keel.unexpected` (stated, no new code); `KEEL_ORIGIN` is optional and `KEEL_PEER_<NAME>` required per other `node` deployable (stated).
- A4 (0349): three tests: forwarding compares every response header less the dropped ones; deploy files run `keel build` from `packages/cli/conformance`; `keel dev` is spawned with `--port` as `dev-port-0091` does. Both k.topology and the new k.deploy then flip to `conformance-covered`.
- A5 (0353): one `KEEL_SECRET` makes caller identity app-wide: whoever holds it, or runs code in one deployable, signs callers every deployable accepts. Stated in k.deploy Build and the threat model.
- A6 (0363): a cron day field starting with `*` (`*` or `*/n`) is unrestricted, as in Vixie cron; `0 0 */2 * 1` fires on odd-day Mondays.
- A7 (0364): `createApp({ maxStreams })`, default 1,000 open event streams per app; one more is 503 `keel.busy` (`data: { limit }`), and no loader runs.
- A8 (0368): `keel check --base` naming no readable surface of this `version` is W1568 (exit 0) and checks no E1562; the generated CI always passes `--base` when it has a base ref. With `topology.ts` unreadable (E1552), E1562 treats every caller and route as split, so it fails closed.
- A9 (0369): `schedule()` throws E2554 for a `job` not in its queue or not its module's, or an `input` the job's schema refuses; a fire stores its mark only after `enqueue` returns `ok`; an `err` rejects `run`, which k.topology reruns.
- A10 (0370 remainder): one runner per queue storage, stated with its consequence (a second process can run a job twice); `job()` throws E2505 for `attempts` or `timeoutMs` that is not a positive integer.
- A11 (0371): `accepts` refuses an open object lacking a field the other declares, unless that field accepts any value; a GET endpoint matches only a route with a loader, and the surface writes no GET answer for a route without one.
- A12 (0372): the generated server, dev and client entries take a stdlib module's routes from its package's `./routes` export; `apps/sessions` stops spreading them into `ops`.
- A13 (0388): in a browser a module call that meets a 3xx is `api.status` with `status` 0 (an opaque redirect); stated, not mapped.

Group B: an API shape or a security property. The orchestrator's working answers are in brackets.
- B1 (0339) [unwrap: yes]: yes, for every non-stream endpoint of a `module` service. The client reads the route's `Result` (GET: `results[id]`), decodes the `ok` value with `output` and a non-2xx `error` with `errors[status]`. The surface records the unwrapped answers and gains `version: 1`.
- B2 (0340) [`Io.evaluate`]: differs: `Io.build`, the disk half of `build` (routes, surface, Vite builds), so MCP `build` and `keel build` run one path. An evaluate hook would leave MCP without the Vite builds and `routes.json`.
- B3 (0346) [`startDev`]: differs: no programmatic entry. `keel dev --port N` with E1560 on a busy port (RFC 0091) already gives a test a known origin and a readiness check (the port accepts); the clause's test spawns the binary.
- B4 (0350) [HMAC: yes]: differs: the header stays a plain loop guard, stated as such in k.topology. The guard gates nothing a client could want, and a signed mark still needs an unsigned fallback to stop loops between peers whose secrets differ. The full HMAC design is under Alternatives for the user's call (Question 3).
- B5 (0354) [a resume helper: yes]: `resumeDocument(html, { routes, ctx? })` from `@keel/testing`, returning the `render` handle; a resume warning rejects with E1720. `apps/sessions` uses it and its `check` script runs `keel check`.
- B6 (0360) [golden-1 migration: yes]: golden-1 already calls `service({ module: 'api' })`, so the migration this RFC names is golden-2's: `recipes` calls `kitchen` through `service({ module: 'kitchen' })`. New E1567 reports a `base` service whose endpoint a route of an app module serves.
- B7 (0342): scaffold re-based 16.5kb to 16.75kb for A8's CI step.
- B8 (0344): `keel check` reports E1559 from the route literals; check re-based 41.75kb to 42.5kb for this RFC's check work.
- B9 (0371, std-jobs half): `callsOf` follows namespace imports, `holdsSecretCall` matches only `@keel/schema`'s `secret`; `@keel/std-jobs/tools` re-based 2.5kb to 2.75kb.

New sections: **k.deploy** (production entry, assets and deploy files, out of k.topology and k.server) and **k.openapi** (the OpenAPI import, out of k.services).

## Problem
- **0341.** `compatChecks.ts` holds the error answer `{ ok: false, error: { code, message, data } }` that each `errors[status]` must accept, and `surfaceRun.ts` prints `E1006 <file> failed to evaluate` for an endpoints file that throws and exits 0. Neither is in the spec, and E1006 in k.compiler and `EXPLANATIONS.ts` covers `routes.ts` only.
- **0343.** The compiler plugin serves `/@keel/entry.ts` as the first `client` deployable's mount entry when one exists, and a `node` document's script points at the same path, so with a `client` and a `node` deployable in `keel dev` the node pages' islands never resume.
- **0348.** `keepRunning.ts` logs a rejected `run` as a `keel.unexpected` diag; k.topology says only "a `diag`". `DeployEnv` parses `KEEL_ORIGIN` as optional and each `KEEL_PEER_<NAME>` as required; k.topology does not say which.
- **0349.** k.topology clauses 2, 6 and 9 lack evidence. The forwarding test compares status, body and `content-type`; the deploy-files test calls the scaffold `place` op and never runs `keel build`; the `keel dev` test is `test.skip` in `packages/server/conformance`, which cannot import the cli.
- **0353.** Every deployable of an app holds the one `KEEL_SECRET` that signs caller cookies; the spec and threat model do not say what follows when one deployable leaks it.
- **0363.** `parseCron` marks a day field restricted when it is not exactly `*`, so `0 0 */2 * 1` fires on every Monday and every odd day.
- **0364.** Each open event stream holds a loader loop, and nothing bounds how many are open.
- **0368.** The generated CI runs `keel check` without `--base` when `git show` of the base surface fails (silenced with `2>/dev/null`), and `compatChecks` counts every pair as one deployable when `topology.ts` does not parse. Both drop E1562 without a word.
- **0369.** `runSchedule` drops the `enqueue` Result and stores the mark, so a refused input loses the fire; an unknown job throws at each fire, and the runner retries every second; `schedule()` validates `cron` and `zone` only.
- **0370.** `runQueue` releases every lease at start and serializes per process, so two processes on one storage can run a job twice; `job()` accepts `attempts: 0`, a fraction or `NaN`.
- **0371.** `accepts` treats a field an open `B` lacks as absent, but an open `B` may carry it with any type; `routeFor` matches a GET to a route with no loader, whose surface GET answer is `value: null` (8 such routes across the three committed surfaces).
- **0372.** The entries import `modules/<m>/routes.ts` for each placed module; a stdlib module (`sessions` in `apps/sessions`) has no such file and is dropped without a diagnostic.
- **0388.** `moduleTarget.ts` sends `redirect: "manual"`; a browser answers a 3xx with an opaque response of status 0, so the caller sees `api.status` `{ status: 0 }`, not the 3xx.
- **0339.** A `module` service decodes the whole k.server answer with `output`, so golden-1 declares `{ id, results: { 'api.lists': { ok, value } } }` (`BoardReply`, `ListsReply`, `SuggestionsReply`) and `{ ok, value }` (`ActionReply`) and reads `r.value.results['api.lists'].value`. An `events` endpoint already unwraps each line's `Result`.
- **0340.** `bin.ts` runs `routesRun`, `surfaceRun` and `viteRun` after the `build` operation; `keel mcp`'s `build` tool runs only the operation, so it writes no `routes.json`, no `surface.json` and no bundles.
- **0346.** The skipped clause-9 test says the spec gives no way to start `keel dev` from a test.
- **0350.** A client that sends `x-keel-forwarded` to `x` for a path `y` serves gets `x`'s 404, not `y`'s answer.
- **0354.** `apps/sessions` tests set `document.body.innerHTML` (E1002) and use `getElementById` and `querySelector` (E1701) to resume server HTML, because `@keel/testing` has no way to do it; the app's `check` script does not run `keel check`.
- **0360.** `surfaceOf` records only `service({ module })`. Golden-2's `recipes` (deployable `web`) calls `kitchen` (deployable `api`) with `service({ base: new URL(url).origin })` in `kitchenApi.ts`, so its three endpoints are outside `keel check --base`.
- **0342, 0344, 0371 budgets.** Measured now (gzip, `tooling/budgets.mjs`'s method): `@keel/scaffold` 16,862 of 16,896 B; `@keel/check` 42,745 of 42,752; `@keel/server` 17,618 of 17,664; `@keel/services` 3,051 of 3,072; `@keel/std-schedules` 1,930 of 2,048; `@keel/std-jobs/tools` 2,533 of 2,560; `@keel/compiler` 28,961 of 29,696; `@keel/cli` 20,174 of 22,528; `@keel/testing` 7,657 of 9,216; `@keel/std-jobs` 2,137 of 3,072. 0344 itself is E1559: `pathCollisions` runs in `keel build` only.

## Proposal

### A1 (0341). Error answers and endpoints files in k.compat
- Every route's error answer is the KeelError `{ code, message, data }` (k.server `publicize`); with B1 a module service decodes that object with `errors[status]`, so `compatChecks.ts` `ERROR_ANSWER` becomes that object (not the `{ ok: false, error }` wrapper).
- An endpoints file that throws when the build evaluates it is E1006 at that file with its first message line, records no endpoint, and makes `keel build` exit 1: a surface missing a caller's endpoints would let E1562 pass a break unseen. With B2 it is a diagnostic record, not a stderr line.
- `EXPLANATIONS.ts` E1006: "routes.ts or an endpoints file fails to evaluate" / "A throw drops that manifest's routes or that file's endpoints." / fix "fix the throw, or export const routes" / "k.compiler, k.compat".
- Files: `packages/check/src/internal/compat/compatChecks.ts`, `packages/check/src/internal/EXPLANATIONS.ts`, `packages/cli/src/internal/surfaceRun.ts`.

Default applied: 6 (the build fails instead of a note on stderr).

### A2 (0343). A resume entry per `node` deployable in dev
- The plugin serves `/@keel/entry.ts?d=<name>` as `RESUME_ENTRY` over `/@keel/islands.ts?d=<name>`, the islands of that deployable's modules. `/@keel/entry.ts` without `d` keeps its present meaning (the `client` deployable's mount entry, or with none the resume entry over every `node` module).
- A dev `createApp` with `deployable` set and no `assets` scripts `/@keel/entry.ts?d=<deployable>`; `devEntryCode` already passes `deployable` per `node` deployable.
- Files: `packages/compiler/src/vite.ts` (`resolveId`, `load`, `deployable()` takes the name), `packages/compiler/src/internal/devEntryCode.ts` (check it passes `deployable`), `packages/server/src/internal/documentResponse.ts`.

Default applied: 3 (the existing resume entry and islands module, keyed by deployable).

### A3 (0348). Runner rejections and `DeployEnv` keys
- k.topology Runners names the code the server already logs: `keel.unexpected`, the code k.server gives an uncaught throw. A runner that rejects is the same event.
- k.deploy Build says `KEEL_ORIGIN` is optional and `KEEL_PEER_<NAME>` required, as `DeployEnv.ts` parses them.
- No code change.

Default applied: 1 (one code for an unexpected throw).

### A4 (0349). The three missing tests
- **Clause 2 (forwarding).** `topology-forwarding-unserved-paths.test.ts` has the peer route answer a generated header set (names from `fc.stringMatching(/^x-[a-z]{1,8}$/)`, values printable ASCII) plus `content-type`, `set-cookie` and a `location` on a 3xx. It compares `x`'s response with the peer's: status, body bytes, and every header but the hop-by-hop ones, those named in `connection`, and `content-encoding`. The clause text stays.
- **Clause 6 (deploy files).** New `packages/cli/conformance/deploy-files-build-0092.test.ts` runs `run(['build'])` with the host `Io` (B2) on a fixture with `node` deployables `x`, `y` and a `client` one. It asserts the four files and no other Dockerfile; changes one generated byte (position from `fc.nat`) and asserts `keel check` gives one E1005 whose fix diff, applied, restores the bytes; moves `b` from `y` to `x` in `topology.ts`, runs `build`, and asserts the changed paths are `topology.ts`, `deploy/**` and `.github/workflows/ci.yml` only. The scaffold test stays as the `place` op's own and cites k.deploy.
- **Clause 9 (`keel dev`).** `packages/server/conformance/topology-keel-dev-one-origin.test.ts` is deleted; new `packages/cli/conformance/topology-keel-dev-one-origin.test.ts` builds a temp project as `dev-port-0091.test.ts` does (linked `@keel/*` and `vite`), with a `client` deployable `c` and `node` deployables `x` and `y`. It spawns `keel dev --port p` (a port from a closed listener on port 0), waits until `p` accepts a socket, then on `http://localhost:p` gets the `client` page (200, HTML scripting `/@keel/entry.ts`), a path of `x` and a path of `y`, and checks that only the spawned process is listening. It signals the child's process group at the end.
- With these, every k.topology and k.deploy clause has a test; both flip to `conformance-covered` (k.deploy holds the moved clauses, A5's sentence and the assets clauses k.server had).

Default applied: 3 (the clause-9 test drives the binary the way `dev-port-0091` already does).

### A5 (0353). One secret, one trust zone
- k.deploy Build: `KEEL_SECRET` "(32+ bytes, shared by the app's deployables so `caller` agrees: whoever holds it, or runs code in one deployable, can sign a caller every deployable accepts)".
- `docs/THREAT-MODEL.md`, **Caller identity**, after "a value the server did not sign counts as none (RFC 0057).": "Every deployable of an app holds the one `KEEL_SECRET`, so `caller` agrees wherever a request lands; whoever reads it, or runs code in any one deployable, can sign a caller cookie that every deployable accepts. An app's deployables are one trust zone for caller identity; parts that must not share it are separate apps with their own secrets."
- No code change. `caller` scopes undo and is not authentication (RFC 0044); the sentence tells an operator which deployables share that trust.

Default applied: 4 (the secret's reach is written where an operator reads it).

### A6 (0363). Vixie day-field rule
- A day field is restricted when its text does not start with `*`. When both are restricted, a day matching either matches; otherwise both must match. `0 0 */2 * 1` fires on Mondays that are odd days; `0 0 * * 1` on Mondays; `0 0 1 * 1` on the 1st and on Mondays.
- Files: `packages/std-schedules/src/internal/parseCron.ts` (`domR`, `dowR` test the first character).

Default applied: 2 (the one rule cron users already know).

### A7 (0364). A cap on open event streams
- `createApp({ maxStreams })`, a positive integer, default 1,000, counts the event-stream GETs it is serving. An event-stream GET that passes the guard while `maxStreams` are open gets 503 `keel.busy` with `data: { limit }` and runs no loader. A stream frees its place when it ends for any reason (`finally` in `liveStream`).
- `keel.busy` is a new kernel KeelError code: status 503, `data: { limit }`. A `service()` events endpoint sees `api.status` 503 with the error as `body` when `errors[503]` declares it.
- The cap is per `createApp`, so per process. 1,000 holds a loader loop each, well under Node's default socket limits; a deployment that needs more sets it.
- Files: `packages/server/src/createApp.ts` (option, counter), `internal/liveStream.ts`, `internal/statusOf.ts`, `types/AppOptions.ts`; `packages/server/README.md`.

Default applied: 6 (the server enforces the bound; no app counts streams).

### A8 (0368). No silent loss of E1562
- `keel check --base <file>` with the file absent, unreadable, not a surface, or of another `version` (B1) is one W1568 at the file ("no base surface of version 1; E1562 not checked") and checks no E1562; exit 0 unless other errors. The first pull request of a project has no base surface, so this is a warning, not an error.
- The generated CI step becomes: when `BASE_REF` is set, `git show "origin/$BASE_REF:.keel/surface.json" > "$base" || rm -f "$base"`, then `pnpm exec keel check --base "$base"`; with no `BASE_REF` (a push), `pnpm exec keel check`. The fallback is then visible as W1568 in the log.
- With `topology.ts` present but unreadable, `keel check` already reports E1552; E1562 now treats every caller and route as in different deployables (`together` is `false` for an unknown topology). A project with no `topology.ts` is one deployable, as today.
- Files: `packages/scaffold/src/templates/ciWorkflow.ts`, `packages/check/src/internal/compat/compatChecks.ts`, `readSurface.ts`, `EXPLANATIONS.ts` (W1568).

Default applied: 6 (the checker reports the gap instead of the CI hiding it).

### A9 (0369). Schedules validate at declaration and keep the fire on failure
- `schedule(queue, table)` throws E2554 for an entry whose `job` is not a key of `queue.table`, whose `job` prefix is not the entry key's module id, or whose `input` fails `queue.table[job].input.parse`. `schedule` runs when the module loads, so the deployable fails at startup with the code instead of retrying each second.
- A fire calls `enqueue` and stores the mark only when it returns `ok`. An `err` throws inside `run`, which rejects; k.topology logs it and runs it again 1,000 ms later, and the missed fire is enqueued then (its key keeps it to one job).
- Files: `packages/std-schedules/src/schedule.ts`, `internal/runSchedule.ts`, and the explanation for E2554 beside the package's rules.

Defaults applied: 6 (validated where it is declared) and 3 (the runner's own rerun path).

### A10 (0370 remainder). One runner per queue, and job options checked
- std.jobs states it: one runner owns a queue's storage; a second process running the same queue releases the first's leases at start and can run a job twice, so a deployable with jobs runs as one instance. The package README says the same under **Run**. A storage compare-and-set would need a `ctx.storage` primitive the kernel does not have; it waits for a need.
- `job()` throws E2505 when `attempts` or `timeoutMs` is not a positive integer (`Number.isSafeInteger(n) && n > 0`).
- Files: `packages/std-jobs/src/job.ts`, `packages/std-jobs/README.md`, the E2505 explanation.

Default applied: 6 (the constructor refuses what the runner cannot run).

### A11 (0371). Sound `accepts` for open objects; GET needs a loader
- `accepts.ts`: for each field `A` declares that `B` lacks, `B` closed passes (it never has the field); `B` open passes only when `A`'s field accepts any value (`s.json()`), else a refusal at that field.
- `routeFor.ts`: GET and HEAD match only a route whose surface entry has a GET answer.
- `surfaceOf.ts`: a route whose own level has no loader writes no `get`. The three committed `apps/*/.keel/surface.json` change (golden-1 5 routes, golden-2 1, sessions 2, all action-only).
- Files: those three, the three surface files (regenerated by `keel build`).

Default applied: 6 (the checker stops passing a pair it cannot prove).

### A12 (0372). Stdlib routes from the package
- For a placed module id with no `modules/<id>/` folder, the entries look for the stdlib package in the project's app-module `deps` whose manifest `id` is that id, and import `<package>/routes` when its `package.json` exports `./routes`; no `./routes`: no routes. The route table, `routes.json`, the client entry and the surface read the same list.
- `apps/sessions/modules/ops/routes.ts` drops `...sessions.routes` and its import; the topology keeps `sessions`.
- A placed id that is neither is E1552 (unknown module), as today.
- Files: `packages/compiler/src/internal/devEntryCode.ts`, `serverEntryCode.ts`, `vite.ts` (`routesFiles`), one shared resolver beside them, `packages/cli/src/internal/surfaceRun.ts`.

Default applied: 1 (k.topology's rule that a stdlib module is placed like an app module, with no re-export).

### A13 (0388). Opaque redirects in a browser
- Fetch gives a manual-redirect response `type: "opaqueredirect"`, `status: 0`, and no readable `Location`. Mapping it to a 3xx would invent a status. k.services states it; a module route the browser calls answers JSON, and a guard that redirects a JSON request is the case to read as `status` 0.
- No code change.

Default applied: 1 (one outcome, `api.status`).

### B1 (0339). A module service unwraps the route's `Result`
- For a `service({ module })` endpoint without `events`, the client parses the JSON body as k.server answers it: GET `{ id, results }`, taking `results[id]` (the matched route's own level; parent levels are ignored); an action, the body itself. That `Result`'s `ok` value is decoded with `output`; on a non-2xx, `err`'s `error` (`{ code, message, data }`) is decoded with `errors[status]` (none declared: `body: null`). A body of another shape is `api.decode`.
- `service({ base })` is unchanged: a third-party body is what `output` describes.
- This matches `events` endpoints, which already decode each line's `Result` this way, and k.compat compares the same values: the GET answer is the loader's `output`, an action's is `Href | null`, the error answer A1's KeelError. The surface file gains `version: 1`; a base without it is W1568 (A8), so the first CI run after the change checks no E1562 and later runs do.
- Files: `packages/services/src/internal/exchange.ts` (a module target unwraps), `moduleTarget.ts`, `packages/cli/src/internal/surfaceOf.ts` (`getAnswer`, `ACTION_ANSWER`, `version`), `packages/check/src/internal/compat/compatChecks.ts`, `readSurface.ts`, `show()` (no `results` prefix).

Defaults applied: 2 (one decode shape for a module call, streamed or not) and 3 (the k.server answer is unchanged).

### B2 (0340). `Io.build`: one build path for the binary and MCP
- `Io` gains `build?: (cwd: string) => Promise<{ code: number; diagnostics: readonly Diagnostic[]; stderr: string }>`: the disk half of `build`, today's post-run block of `bin.ts` (`routes.json` when every deployable is `node`, `surface.json`, one Vite build per `viteTargets`).
- The `build` operation calls `io.build(cwd)` after its own writes when it exits 0, adds the diagnostics to its output and the `stderr` text (a failed Vite build's tail) to its stderr, and takes the larger exit code. `hostIo` supplies it, so `keel build` and `keel mcp`'s `build` tool run one path; `bin.ts` loses its block. An `Io` without `build` (tests over in-memory files) writes the engine's artifacts only.
- `surfaceRun`'s E1006 lines become diagnostics (A1).
- Why not `Io.evaluate`: evaluation covers `surface.json` and `routes.json`, but the Vite builds would stay in `bin.ts`, and MCP `build` would still produce no bundles.
- Files: `packages/cli/src/types/Io.ts`, `internal/hostIo.ts`, the `build` operation, `bin.ts`, `routesRun.ts`, `surfaceRun.ts`, `viteRun.ts` (return records), `packages/cli/README.md`.

Default applied: 3 (one build path, reached through the host `Io` both surfaces share).

### B3 (0346). No programmatic `keel dev`
- RFC 0091 gave `keel dev --port N` with E1560 and exit 1 on a busy port, so a test picks a free port, spawns the binary and waits for the port to accept; `dev-port-0091.test.ts` already does this. A `startDev({ cwd, port })` would be a second way to start the dev server and an API to keep beside the command (default 2).
- The clause-9 note "UNTESTABLE" goes with the deleted file (A4).

Default applied: 2.

### B4 (0350). `x-keel-forwarded` stays a plain loop guard
- k.topology says what the threat model says: the header is a loop guard only; any client may send it, and then the receiving deployable answers for itself.
- What a signature buys: a client that sends the header gets `y`'s answer instead of `x`'s 404. The header grants nothing. Guards run at the deployable that answers, the caller cookie is checked there with the shared secret, and a browser sends a custom header cross-site only after a preflight the app does not grant, so no third party can make a victim's request carry it.
- What it costs: a key, a MAC per forward, and a loop when two peers hold different secrets and disagree on who serves a path (a rolling deploy that moves a route). Each would drop the other's mark as invalid and forward again. Stopping that needs a second marker that is not checked, which any client can send, so the property the signature was for is lost again.
- The design, if the user wants it anyway, is under Alternatives.

Defaults applied: 1 and 6 (one marker; the guard the kernel enforces does not rest on a secret).

### B5 (0354). `resumeDocument` in `@keel/testing`
```ts
const res = await app.fetch(new Request('http://t.test/ops/drill'))
const t = await resumeDocument(await res.text(), { routes, ctx })
await t.fire('ops.drill.go', { type: 'click' })
expect(session(ctx).taken()).toHaveLength(1)
t.dispose()
```
- `resumeDocument(html, { routes, ctx?, artifacts? })` takes a document a server rendered, puts its `<body>` (scripts dropped) into the harness root, reads `#k-state`, and calls `resume` (k.runtime) with the island components of `routes` (each route's `component`, by route id) and `ctx` (default: a sim ctx, as `render`). It resolves with the `render` handle (`a11y`, `state`, `fire`, `settle`, `find`, `dispose`) after the first settle; the axe and `a11y.json` checks run as for `render`.
- A resume warning (an island root with no component in `routes`, state that fails its schema) rejects with E1720 naming the first warning. The DOM work stays inside the harness, so tests keep E1002 and E1701.
- `apps/sessions`: `test/resumeRecording.test.ts` and `test/resumeReplay.test.ts` use it, `find` and `fire`. The `pre[data-k-error]` lookup becomes `find` on the route's `errorElement` id. The `check` script becomes `tsc --noEmit && biome check modules test && keel check`.
- Files: `packages/testing/src/resumeDocument.ts`, `index.ts`, `README.md`; the two tests and `apps/sessions/package.json`; E1720 in `EXPLANATIONS.ts`.

Defaults applied: 3 (the runtime's `resume` and the harness handle) and 6 (tests stay under E1002 and E1701).

### B6 (0360). Same-app `base` services are reported; golden-2 moves to `module`
- Golden-1 calls `service({ module: 'api' })` since RFC 0087. Golden-2 is the app the backlog line describes: `kitchenApi(origin)` returns `service({ base: origin, schema: kitchen })`, called from `loadRecipe`, `favoriteRecipe` and `createRecipe`.
- New E1567 (k.compat, check rule): a `service({ base })` call in app code whose `base` is not a string literal URL and whose `schema` (an `endpoints` literal the check resolves) has an endpoint a route of an app module of this project serves (method and `samePath`), at `base`, naming the module. No fix: the module, `deps` and `public.routes` edits span files. A literal `https://...` base is another service and is never reported.
- Golden-2: `kitchenApi.ts` becomes `export const kitchenApi = service({ module: 'kitchen', schema: kitchen })`; the three callers drop `new URL(url).origin`; `recipes` lists `kitchen` in `deps`; `kitchen` lists the three route ids in `public.routes`; `kitchen.service.ts` outputs follow B1 (`BoxReply` to the loader's value type, `ActionReply` to `s.string().nullable()`). A `client` deployable's module call resolves to `host` `api`'s origin (k.hosting).
- Files: a check rule in `packages/check/src/rules/`, `EXPLANATIONS.ts`; golden-2 files above; `apps/golden-2/.keel/surface.json`.

Defaults applied: 1 (one way to call an app module) and 6 (a rule, not a note).

### B7 (0342). Scaffold budget
`@keel/scaffold` is 16,862 of 16,896 B (16.5kb, re-based once already). A8 adds a CI template branch (about 40 B). Re-base to 16.75kb (17,152 B); commit reason: "0368: the CI step passes `--base` and lets W1568 report a missing base".

Default applied: 7.

### B8 (0344). E1559 in `keel check`, and the check budget
- `keel check` calls `pathCollisions` (`@keel/compiler`, below check in `tooling/deps.json`) on the route literals and the topology it already reads, and reports E1559 at the second route's key, naming both. `keel build` keeps its call. One function, two callers.
- `@keel/check` is 42,745 of 42,752 B (41.75kb). This RFC adds to it: E1559's call, W1568 and the `version` read, E1567, the `accepts` and `routeFor` changes, B1's error answer, and four explanations (W1568, E1567, E1720, the wider E1006): about 500 B. Re-base to 42.5kb (43,520 B); commit reason: "rfc:0092 check work: E1559 in check, W1568, E1567, sound open-object accepts".
- Files: `packages/check/src/check.ts` or a rule beside `routesMismatch.ts`.

Defaults applied: 3 (the build's function, reused) and 7.

### B9 (0371, std-jobs half). Tools see namespace imports and only the schema `secret`
- `callsOf` also collects `ImportNamespaceSpecifier` locals and matches `ns.job(...)`; `holdsSecretCall` matches a `.secret()` call only when its object is a local bound to `@keel/schema`'s `s` (named or namespace import), so `vault.secret()` is not E2503.
- `@keel/std-jobs/tools` is 2,533 of 2,560 B; the two changes and E2505's explanation add about 200 B. Re-base to 2.75kb (2,816 B); commit reason: "rfc:0092 std-jobs tools: namespace imports, schema-only `secret`, E2505".
- Files: `packages/std-jobs/src/tools/internal/callsOf.ts`, `holdsSecretCall.ts`.

Default applied: 7.

Other budgets this RFC moves (commit reasons as above): `@keel/server` 17.25kb to 17.5kb (17,920 B; A7 counter and option, A2 entry path); `@keel/services` 3kb to 3.25kb (3,328 B; B1 unwrap); `@keel/std-schedules` 2kb to 2.25kb (2,304 B; A9 validation). `@keel/compiler`, `@keel/cli`, `@keel/testing` and `@keel/std-jobs` fit.

## Alternatives
- **A2: one entry that resumes and mounts by page.** It would ship the client router to node pages. **Serve per deployable on separate ports:** k.topology says one origin.
- **A3: a new code for a rejected runner.** A second code for "an unexpected throw".
- **A7: no option, a fixed 1,000.** Deployments behind a proxy that holds many idle streams need more; `maxBodyBytes` is the same kind of bound and is an option. **429:** the client did nothing wrong; the server is full.
- **A8: an error for a missing base.** Fails the first pull request of every project.
- **A9: validate in a check rule.** `input` is a runtime value; the literal case would still need the runtime check.
- **A10: a lease owner and expiry in storage.** Needs an atomic compare on `ctx.storage` the kernel lacks (default 1 points to a kernel change, which waits for a need).
- **A13: map an opaque redirect to 303.** Invents a status the response did not carry.
- **B1: unwrap only GET.** Actions would keep `{ ok, value }` in `output` and the two kinds would differ. **A `results` option on the endpoint:** a second spelling for one call.
- **B2: `Io.evaluate`.** See B2.
- **B3: `startDev({ cwd, port })` returning `{ url, close }`.** A second way to start dev (default 2).
- **B4: sign the header.** If the user wants it: key `fk = HMAC-SHA-256(KEEL_SECRET, "keel forwarded 1")` (domain-separated from the caller key; the label holds spaces, so no minted base64url cookie token equals it); value base64url `HMAC-SHA-256(fk, METHOD + " " + path + search)`, set by `forward.ts` over the outgoing method and path; verified by recomputing over the arriving method and path, a length check, then `timingSafeEqual` (`node:crypto`, as `callerSigner.ts` does). No timestamp: a replayed value only makes the receiver answer that method and path for itself. An invalid or absent value is removed and the request is treated as an outside one. The dev entry passes one process secret to every `createApp` so in-process peers verify. Residual: peers with different secrets that disagree on a path forward in a loop unless an unsigned hop count is added, which a client can set. Not taken (B4).
- **B5: `renderRoute` with an `html` option.** The same function would mean "render" or "resume" by option. **Allow E1002 in test files:** opens raw HTML to every test.
- **B6: record `service({ base })` in the surface.** A `base` call may target any service; only a match against this app's routes says which module it means, and then `module` is the one way to say so.

## Spec diff
Sizes are `tooling/spec.mjs`'s count (characters / 4) of each section with every change applied, measured on the current files. Every addition to a full section is paid by a move to a new section or a trim that removes no rule, code or conformance clause; no trimmed text is quoted by a conformance header (searched in `packages/*/conformance`).

**New section k.deploy** (`spec/kernel/k.deploy.md`, about 800). Title "k.deploy: Production entry and deploy files", status `implemented` (to `conformance-covered` with A4).
- Moves from k.topology, with the changes below: the **Build** paragraph, the **Deploy files** paragraph with its three bullets and "`DeployEnv` values are set where the image runs, in no generated file.", Rules "E1560 `DeployEnv` fails, or a port will not bind, at startup", and the Conformance clauses "`node dist/<name>/server.mjs` of a `keel build` fixture …" and "With `node` deployables `x`, `y` and a `client` one, `keel build` writes …".
- Moves from k.server as **Assets.**: the sentence "Production `createApp({ assets: 'dist/<name>' })` loads the client build at startup, scripts its entry, serves `/assets/*` and `/keel-mark.svg` (`nosniff`; `immutable` if the manifest names it hashed, else `no-cache`, ETag)."; Rules "E1555 production `assets` missing or entry-less" (written "(k.server)" after it); the Conformance clauses "`createApp({ assets })` on a `keel build` node fixture scripts …", "Built files are `nosniff` …", "Production `createApp` without `assets` rejects at startup with E1555 …".
- Changes in the moved Build text: "`KEEL_ORIGIN` (`createApp({ origin })`" becomes "`KEEL_ORIGIN` (optional; `createApp({ origin })`"; "`KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees)" becomes "`KEEL_SECRET` (32+ bytes, shared by the app's deployables so `caller` agrees: whoever holds it, or runs code in one deployable, can sign a caller every deployable accepts)"; "an http(s) URL, per other `node` deployable." becomes "an http(s) URL, required per other `node` deployable.".
- Change in the moved CI bullet: "`keel check --base` the base branch's surface (k.compat)" becomes "`keel check --base` the base branch's surface (k.compat; none there: W1568)".
- Order: Build, Assets, Deploy files, Rules, Conformance.

**k.topology** (1,497 to 1,017)
- Build paragraph becomes "**Build.** `keel build`, `server.mjs`, `DeployEnv`, `assets` and deploy files: k.deploy."; the Deploy files paragraph and the two clauses move (above).
- Route table: replace "The generated entry merges each module's `routes` into `createApp({ routes })`." with "The generated entries merge each module's `routes` into `createApp({ routes })`: an app module's `modules/<id>/routes.ts`, a stdlib module's package `./routes` export (none: no routes)."
- Runners: replace "is a `diag` and runs again" with "is a `keel.unexpected` `diag` and runs again".
- Calls and peers: replace "(unreachable: 502 `keel.unreachable`); one carrying `x-keel-forwarded` is not forwarded." with "(unreachable: 502 `keel.unreachable`); one carrying `x-keel-forwarded` is not forwarded (a loop guard only: any client may send it)."
- Local topology: replace "and serves its paths." with "and serves its paths; its documents resume its own islands (k.server Build)."
- Rules: replace "E1559 one path in two deployables (names both) · E1511 (k.api) · E1560 `DeployEnv` fails, or a port will not bind, at startup." with "E1559 one path in two deployables (names both; `keel check` and `keel build`) · E1511 (k.api) · E1560 (k.deploy)."
- Conformance: "Two routes with path `/p` in modules of different deployables are one E1559." becomes "… are one E1559 in `keel check` and in `keel build`."

**k.server** (1,499 to 1,484)
- Build paragraph becomes "**Build.** Production `assets`: k.deploy. Runners, peers, `keel dev`: k.topology. In dev, or with no `assets` in development/test, a document scripts `/@keel/entry.ts?d=<deployable>`, the resume entry of the islands of `createApp({ deployable })`'s modules (none given: every `node` module's)."; E1555 and the three assets clauses move to k.deploy.
- Request flow: replace "guard denial 403 `keel.denied`, else a `data:` line" with "guard denial 403 `keel.denied`; past `createApp({ maxStreams })` (default 1,000) open streams 503 `keel.busy` (`data: { limit }`); else a `data:` line".
- Status: after "`keel.unreachable` 502 (names no host) ·" add "`keel.busy` 503 ·".
- Conformance, at the end: "With `maxStreams: 2`, a third open event-stream GET is 503 `keel.busy` and runs no loader; once one closes, the next is served." and "With a `client` and a `node` deployable in dev, the `node` one's island document scripts `/@keel/entry.ts?d=<name>`, which resumes its islands."

**k.errors** (1,489 to 1,492)
- API: replace "`keel.payloadTooLarge`, `keel.conflict` and `keel.unreachable` (k.server)" with "`keel.payloadTooLarge`, `keel.conflict`, `keel.unreachable` and `keel.busy` (k.server)".

**New section k.openapi** (`spec/kernel/k.openapi.md`, about 410). Title "k.openapi: OpenAPI import", status `conformance-covered`. Moves from k.services: the **OpenAPI** paragraph, as **API.**, and the clause "The client generated from the OpenAPI fixture has one method per operation, with input and output types matching it."

**k.services** (1,496 to 1,220)
- The OpenAPI paragraph and clause move to k.openapi.
- API: replace "It follows no redirect: a 3xx is `api.status`." with "It follows no redirect: a 3xx is `api.status` (in a browser `status` 0, an opaque redirect)."
- Encoding: replace "Responses decode with `output`." with "A `base` service decodes a body with `output`; a `module` service reads the route's `Result` (GET: `results[id]`, the matched route's own) and decodes its `ok` value with `output` and, on a non-2xx, its `error` with `errors[status]`."
- Conformance, at the end: "A `module` GET endpoint whose `output` is the loader's `output` yields `ok(v)` for a loader `ok(v)`; a loader `err` `keel.notFound` yields `api.status` 404 with `body` the KeelError decoded by `errors[404]`."

**k.compat** (892 to 1,195)
- Surface: replace "its GET answer (`{ id, results }` of its chain's loader `output`s, k.server) and, per action method, its `input` and answer (`Result` of `Href | null`);" with "its GET answer (its loader's `output`; none without a loader) and, per action method, its `input` and answer (`Href | null`); every route's error answer is a KeelError `{ code, message, data }`;". Replace "Schemas are JSON Schema, as in `routes.json`." with "Schemas are JSON Schema, as in `routes.json`; the file holds `version: 1`.". Replace "each file whose `endpoints` a `service({ module })` names." with "each file whose `endpoints` a `service({ module })` names; one that throws is E1006 (k.compiler), records no endpoint and fails the build."
- Accepts: replace "whose fields it accepts field by field," with "whose fields it accepts field by field (a field an open one lacks only if that field accepts any value),".
- Endpoints: replace "(GET: the loader; others: `routes.actions`)" with "(GET: a route with a loader; others: `routes.actions`)"; replace "and the endpoint's `output` and `errors` must accept the route's answer (E1561)." with "and the endpoint's `output` must accept the route's answer and each `errors[status]` its error answer (E1561)."
- Base: replace "Without `--base`, no E1562." with "Without `--base`, no E1562; a base file absent, unreadable or of another `version` is W1568 and no E1562. With `topology.ts` unreadable (E1552), every caller and route count as split."
- Rules, after E1562's text: "· E1567 a `service({ base })` in app code, `base` not a URL literal, with an endpoint a route of an app module serves (method and path), at `base`, naming the module; no fix (use `service({ module })`) · W1568 `--base` names no readable surface of this `version`".
- Conformance, at the end:
  - "An open `{ a?: string }` does not accept an open `{}` and accepts a closed `{}`."
  - "A GET endpoint to a route with no loader is one E1561."
  - "`keel check --base` naming a missing file is one W1568 and exits 0; with `topology.ts` unreadable, a base endpoint the current route refuses is E1562."
  - "`service({ base: origin, schema })` with an endpoint that a route of app module `b` serves is one E1567 naming `b`; with `base: 'https://api.example.com'` none."
  - "An endpoints file that throws is one E1006 from `keel build`, which exits 1."

**k.cli** (1,489 to 1,487; the spec-and-explain count falls too)
- Conformance, before the `keel inspect` unreachable clause: "An MCP `build` writes the `.keel/` files `keel build` writes."
- Trims: "(one MCP tool per operation; input schema as JSON Schema)" becomes "(one MCP tool per operation)" (the clause "Each MCP tool's input schema equals the JSON Schema of its operation's input." states it); "prints one `inspect.store` record per store, one `inspect.section` per section, and a summary of counts." becomes "prints one `inspect.store` record per store and a summary of counts." (the clause "`keel inspect` prints one `inspect.section` per section; …" states it); the row "summarize a running dev app's inspect document" becomes "summarize a dev app's inspect document" (`[url]` and the Inspect paragraph say it runs).

**k.testing** (1,490 to 1,498)
- Harness, before "Tests address elements by id only.": "- `resumeDocument(html, { routes, ctx? })`: a server document's islands resumed, as a `render` handle (a resume warning: E1720)."
- Rules: before "E1707": "E1720 (`resumeDocument`) ·".
- Conformance, at the end: "`resumeDocument` of an island document from `createApp` lets `fire` run the island's handlers; an island missing from `routes` is E1720."
- Trims: the Failure output code block (its one line repeats the prose and E1704's rule); the Properties code block `properties(CartView)` / `properties(addItem)` (the next sentence names both targets); the harness example line `expect(t.state(cart).items).toHaveLength(1)` (the `state(store)` bullet defines it).

**std.jobs** (1,045 to 1,167)
- API: replace "`job({ input, attempts = 3, timeoutMs = 60000 }, fn)`:" with "`job({ input, attempts = 3, timeoutMs = 60000 }, fn)` (positive integers, else `job` throws E2505):".
- Restart: after "so `fn` must be idempotent." add "One runner owns a queue's storage: a second process running it releases the first's leases at start and can run a job twice, so a deployable with jobs runs as one instance."
- Rules, at the end: "· E2505 `attempts` or `timeoutMs` not a positive integer (`job` throws it)".
- Conformance, at the end: "E2503 fires for `job` reached through `import * as jobs` and not for a `.secret()` call on an object other than `@keel/schema`'s `s`." and "`job` with `attempts: 0` or `timeoutMs: 1.5` throws E2505."

**std.schedules** (827 to 966)
- API: replace "When both day fields are restricted, a day matching either matches." with "A day field not starting with `*` is restricted; when both are, a day matching either matches, else both must match (`0 0 */2 * 1`: odd-day Mondays)."; replace "`input` (that job's input type), `missed`" with "`input` (that job's input type; `schedule` throws E2554 for a `job` not in `queue` or not its module's, or an `input` the job's schema refuses), `missed`".
- Run: replace "then stores `t` as the entry's mark" with "and on `ok` stores `t` as the entry's mark"; after "also when a crash falls between the two steps." add "An `err` stores no mark and rejects `run`, which k.topology runs again."
- Rules, at the end: "· E2554 a `schedule` entry's `job` or `input` refused (thrown by `schedule`)".
- Conformance, at the end: "`0 0 */2 * 1` fires on Mondays that are odd days of the month and on no other day." and "`schedule` throws E2554 for a `job` absent from `queue`, one of another module, and an `input` its job's schema refuses."

**spec/00-map.md** (about 941 to 1,025)
- Code ranges: "E155x | k.server, k.topology, k.compat, k.hosting" becomes "E155x | k.server, k.topology, k.deploy, k.compat, k.hosting".
- k.topology row summary "placement, runners, peers, production entry, deploy files" becomes "placement, route table, runners, peers, `keel dev`".
- After the k.topology row: "| k.deploy | Production entry and deploy files | implemented | `keel build` output, `server.mjs`, `DeployEnv`, assets, deploy files |".
- After the k.services row: "| k.openapi | OpenAPI import | conformance-covered | OpenAPI 3 document to endpoints and client sources |".

`docs/THREAT-MODEL.md`: the A5 sentences in **Caller identity**.

## Conformance diff
Written by the `conformance-writer` from the clauses above. This RFC allows these changes under `packages/*/conformance/**`:
- Deleted: `packages/server/conformance/topology-keel-dev-one-origin.test.ts` (its clause moves to the cli test).
- New: `packages/cli/conformance/topology-keel-dev-one-origin.test.ts` (A4 clause 9); `packages/cli/conformance/deploy-files-build-0092.test.ts` (A4 clause 6); `packages/cli/conformance/compat-0092.test.ts` (the five k.compat clauses); `packages/cli/conformance/mcp-build-0092.test.ts` (an MCP `build` and `keel build` on one fixture write equal `routes.json` and `surface.json`); `packages/server/conformance/stream-cap-0092.test.ts`; `packages/server/conformance/dev-entry-0092.test.ts`; `packages/services/conformance/module-unwrap-0092.test.ts`; `packages/testing/conformance/resume-document-0092.test.ts`; `packages/std-jobs/conformance/e2505.test.ts`; `packages/std-schedules/conformance/day-fields-0092.test.ts`; `packages/std-schedules/conformance/e2554.test.ts`.
- Changed header only (section move): `packages/server/conformance/topology-server-mjs.test.ts`, `build-assets.test.ts`, `build-assets-headers.test.ts`, `e1555-production-assets.test.ts` and `packages/scaffold/conformance/topology-deploy-files.test.ts` cite k.deploy; `packages/services/conformance/openapi-client.test.ts` cites k.openapi.
- Changed cases: `topology-forwarding-unserved-paths.test.ts` (every header, A4); `packages/cli/conformance/topology-e1559-same-path.test.ts` (a `keel check` case and the changed clause text); `packages/cli/conformance/compat-accepts-property.test.ts` (generated values of an open `B` carry extra keys of any type, which the old rule let through); `packages/std-jobs/conformance/e2503.test.ts` (namespace import, `vault.secret()`); `packages/std-schedules/conformance/next-fire-matches-cron.test.ts` (its oracle follows A6, if it encodes the day rule).
- Fixtures that declare the k.server envelope as a `module` endpoint's `output` change to the unwrapped value (B1): `E1561-endpoint-refused.test.ts`, `E1562-base-*.test.ts`, `topology-one-vs-split-equivalence.test.ts`, `topology-service-in-process-vs-net.test.ts`, and `packages/services/conformance/network-failure.test.ts` if it decodes an `ok` body. Each is a fixture-schema change; no clause text changes there.
- Ledger: k.topology and k.server clause numbers shift with the moves; k.deploy and k.openapi clauses are new items. `keel ledger --diff` after the move compares the moved clauses under their new ids; the orchestrator re-commits the ledger with the change.

## Diagnostics
Each new code is absent from `spec/`, `packages/*/src` (`EXPLANATIONS.ts` and stdlib `tools` included), `docs/`, `apps/` and `tasks/` (searched 2026-11-12).
- **E1567** (k.compat, E155x; E1563 and W1564 are reserved by RFC 0085, E1565 and E1566 are used, E1567 has no hit): a same-app `service({ base })`. Explanation: "a `base` service calls this app's routes" / "use `service({ module })`; add the module to `deps` and the routes to its `public.routes`".
- **W1568** (k.compat, E155x; no E1568 or W1568 anywhere): `--base` names no readable surface of this `version`. Explanation: "base surface missing; E1562 not checked" / "fetch the base branch's `.keel/surface.json`, or rebuild it with this keel".
- **E1720** (k.testing, E17xx; E1701 to E1713, W1714, E1715 to E1719 are taken; E1720 occurs only as a made-up string in a std-sessions unit test fixture, `packages/std-sessions/test/action.test.ts`, which the implementer changes to another value): `resumeDocument` warned. Explanation: "the document did not resume" / "add the island's route to `routes`, or fix the state the server wrote".
- **E2505** (std.jobs; E2500 to E2504 taken): `attempts` or `timeoutMs` not a positive integer.
- **E2554** (std.schedules; E2550 to E2553 taken): a schedule's `job` or `input` refused.
- E1006 widened to endpoints files (A1); E1559 also from `keel check` (B8). `keel.busy` is a KeelError code (data), not a diagnostic.

## Token impact
Every section stays at or under 1,500 (figures in Spec diff); the map stays under 1,200. Package sizes: see B7, B8, B9 and the list after B9. `@keel/compiler` about +250 B (A2, A12), `@keel/cli` about +150 B (B2), `@keel/testing` about +400 B (B5), `@keel/std-jobs` about +60 B (E2505).

## Migration
- **golden-1 (B1):** `todos.service.ts` outputs: `lists` `BoardView`; `createList`, `addTodo`, `toggleTodo`, `editTodo`, `undo` `s.string().nullable()`; `editTodo` `errors: { 422: FieldsReply }` with `FieldsReply` = `s.object({ code: s.string(), message: s.string(), data: s.json() })`. `board.service.ts` `BoardView`; `suggestions.service.ts` `s.array(Suggestion)`. `BoardReply`, `ListsReply`, `SuggestionsReply` and `ActionReply` schema files are deleted. `refreshView.ts`, `Suggestions.tsx` and `recount.server.ts` read `r.value`. `test/board.test.ts` and `test/components.test.ts` stub bodies stay k.server answers (the server is unchanged) and their expectations read the unwrapped value. `.keel/surface.json` regenerates.
- **golden-2 (B1, B6):** as B6; `kitchen.service.ts` outputs unwrapped; `recipes` manifest `deps` gains `kitchen`; `kitchen` `public.routes` gains its three route ids; `.keel/surface.json` regenerates.
- **apps/sessions (A12, B5):** `ops/routes.ts` drops the std-sessions spread; the two resume tests use `resumeDocument`; `check` runs `keel check`; `.keel/surface.json` regenerates.
- **Projects outside the repo:** a `module` service's `output` and `errors` schemas change as golden-1's do (E1561 points at each); the first CI run after upgrading reports W1568 against the older base surface; `keel build` regenerates `.github/workflows/ci.yml` (E1005 until then); a cron with `*/n` in one day field and the other day field restricted fires on fewer days; an app holding more than 1,000 open event streams per process sets `maxStreams`; a project that re-exports a placed stdlib module's routes from an app module drops the re-export, since the entries now import them.

## Questions
The RFC defaults escalate new hand-written user-facing API shapes, anything that weakens privacy or auth, external integrations, and golden-app migrations. Answers taken:
1. **B1, a `module` service unwraps the route's `Result`, with the golden-1 and golden-2 schema migration.** Recommended: accept. Every module call then reads the value its route's loader or action returns, as `events` endpoints already do.
   Taken: accepted as recommended.
2. **B6, golden-2's `recipes` calls `kitchen` through `service({ module: 'kitchen' })`, and E1567.** Recommended: accept; it is the migration 0360 asked for, on the app that still needs it.
   Taken: accepted as recommended.
3. **B4, `x-keel-forwarded` stays an unsigned loop guard** (the orchestrator's working answer was to sign it). Recommended: keep it unsigned and state it; the signature protects no request and still needs an unsigned loop stop. The signed design is ready under Alternatives if the user prefers it.
   Taken: accepted as recommended.
4. **A7, `createApp({ maxStreams })` (default 1,000) and the KeelError code `keel.busy` (503).** Recommended: accept both names and the default.
   Taken: accepted as recommended.
5. **B2, `Io.build` on `@keel/cli`'s `Io`** (the working answer was `Io.evaluate`). Recommended: `Io.build`, so MCP `build` writes everything `keel build` writes.
   Taken: accepted as recommended.
6. **B5, `resumeDocument(html, { routes, ctx?, artifacts? })` in `@keel/testing`.** Recommended: accept the name and shape; it returns the `render` handle tests already use.
   Taken: accepted as recommended.
7. **B3, no `startDev`** (the working answer was to add one). Recommended: no new entry; the clause-9 test spawns `keel dev --port`.
   Taken: accepted as recommended.
