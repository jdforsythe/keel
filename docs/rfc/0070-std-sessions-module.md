# RFC 0070: the @keel/std-sessions module, kernel observers, and the session commands

Status: draft (ADR-0059 proposed)

## Problem
Backlog 0092 builds `@keel/std-sessions` from spec/std/std.sessions.md (1,498 tokens, status proposed). Backlog 0091 wrote its conformance suite first: 13 files under `packages/std-sessions/conformance/`, all `describe.skip`. The conformance-writer could not write a passing test for 7 clauses, because the section leaves these points open.

1. **Redact list under sim.** `record` reads `redact` through `stdConfig`, which only `createApp({ std })` binds. A test with a sim ctx has no way to bind it.
2. **Overflow.** The section does not say what the buffer keeps when it overflows with no `nav` in it. A test cannot navigate either: the route harness has no `navigate`.
3. **Replay result.** `reproduced` is defined only for a session with an error, and the result has no `state`, which the clause "reproduces every store's final state" needs.
4. **`minimize` and `to-test`.** The section names no buggy fixture and no fix, gives no output path for `minimize`, does not say which events are inputs, and gives no way to run `keel test` from code.
5. **Ingest.** A test cannot get the module's route manifest, has no `sessions.reader` guard (E1506 is the k.router layout code, and a guard is a value, not an id), and the `sessions.list` response has no shape.
6. **E2002-E2004.** The section gives no output record shape, does not say whether N counts from 0, and does not say how `ids.json` reaches `keel session`.
7. **`taken()`.** Its shape is unspecified.

The kernel is also missing pieces the module needs:
- `resource`, `fire` and `error` events "come from inspector hooks (rfc 0063)". But inspector hooks are pull-only sections (`read(ctx)`, RFC 0042), and no kernel package reports events anywhere a stdlib package can listen.
- `Session.seed` needs the ctx's seed, and `Ctx` does not expose it.
- To redact a `tx:` path, `record` needs the payload schema of a logged transaction. A `LogEntry` carries only the name.
- `stores()` is not reactive. A recorder started before a store exists never sees that store's commits.
- k.cli reserves `session` for this module but gives no way to fill the reservation. `tooling/deps.json` forbids `@keel/cli` from importing a stdlib package.
- `importDeps` imports a package's root entry. std.sessions has a browser half (`record`, which `clientStd` serves) and a node half (check rules, the formatter, the CLI command, which pull in `@keel/check` and `typescript`). One entry cannot hold both.

Backlogs 0093 (ingest service), 0094 (`keel session` commands) and 0095 (GitHub Action) consume this contract, so it settles their interfaces now.

## Proposal

### 1. Package layout
- **Entries.** `@keel/std-sessions` keeps the stdlib-module layout of std.health: `module.ts` at the package root, and app code imports a public file as `@keel/std-sessions/<File>` (k.module: no barrels). `package.json` exports `.` (re-exports, for tests and node), one subpath per public file (`./record`, `./session`, `./Session`, `./replay`, `./minimize`, `./routes`), and `./tools`.
- **Root.** `src/index.ts` re-exports the public files and their types. It imports no `@keel/check`, `@keel/cli` or `vitest`.
- **Tools.** `src/tools.ts`, a node-only entry, registers E2001 and E2005 (`defineRule`), the `session` formatter, and the `session` command (`stdCommand`). It also imports `SessionsConfig.ts`.
- **Loading.** `importDeps` imports each `@keel/std-*` package as today, then its `./tools` export when the `exports` map has one (k.module diff). `keel check`, `keel build` and `keel session` therefore see the rules and the command, while a browser bundle of `@keel/std-sessions/record` holds no tooling.
- **Manifest.**

  ```ts
  export default module({
    id: "sessions",
    deps: [],
    capabilities: ["clock", "session", "storage"],
    public: { exports: ["record", "replay", "minimize", "session", "Session", "routes"], routes: ["sessions.ingest", "sessions.list"] },
  });
  ```

  `random` leaves the list. `record` no longer draws from `ctx.random` (section 4).
- **Config.**

  ```ts
  SessionsConfig = s.object({ redact: s.array(s.string()), readers: s.array(s.string()).optional() }, { closed: true })
  ```

  It stays in `SessionsConfig.ts` with `s.register("@keel/std-sessions", SessionsConfig)`, followed by `clientStd("@keel/std-sessions")` (rfc:0069; this closes the `TODO 0092` line there). `readers` is new (section 9).
- **Dependencies.** `@keel/ctx`, `@keel/schema`, `@keel/store`, `@keel/reactive`, `@keel/router`, `@keel/compiler` (subpaths `std/stdConfig`, `std/clientStd`, `inspect/inspector`), and `@keel/testing` (`replay`, `minimize`). `@keel/check` and `@keel/cli` are needed only by `tools.ts`. `tooling/deps.json` appends `std-sessions` after `std-report`.

### 2. Kernel additions
Each addition is small, sits in the section that owns the code, and fits that section's budget (Token impact).

- **Observers (k.ctx).**
  - **API.** `observe(ctx, fn)` subscribes `fn` to the events kernel code reports on a ctx. It returns a stop function. Kernel producers call `report(ctx, event)` from `@keel/ctx/internal`, which is not public.
  - **Producers.**
    - The router reports `nav` when a navigation starts, before guards. The event carries the matched route's id, path pattern, decoded `params` and `search`, and their schemas.
    - runtime-dom's delegated listener reports `fire` for a `click`, `input`, `change`, `keydown`, `submit`, `focus` or `blur` on an element with an id, before handlers run. For an `<input type="password">` it reports the value as `x` repeated, so no observer ever sees a password.
    - `Match` reports `resource` when it renders a state. The `id` is the resource's `inspect()` node id: `resource(fetcher)` has no ctx and no id of its own, and E1204 routes every rendered resource through `Match`.
    - `Boundary` reports `error` when it catches, and the router reports `error` when a loader or action returns `err`.
  - **Current route.** A new observer first receives the ctx's current `nav`, if one exists. This lets a recorder started after mount know its route.
  - **Isolation.** Observers run synchronously, in registration order. A throw in one is dropped, so observing never changes app behavior.
  - **Seed.** `seedOf(ctx)` returns the seed given to `createCtx`, default 0. It is a function, so `Ctx` gains no field (RFC 0066 rejected `ctx.std` for the same reason).
  - **Event type.** `FireEvent` is defined in `@keel/ctx`, and k.testing's `TestEvent` becomes an alias of it. The union stays defined in one place.
- **Reactive registry and payload schemas (k.store).** An effect that reads `stores()` reruns when a store joins or leaves the registry. A store exposes `payloads: ReadonlyMap<string, Schema<unknown>>`, its transactions' payload schemas by name. Exposing the `Transaction` objects was rejected, since any reader could then `tx` them.
- **Harness navigation (k.testing).** A `renderRoute` handle gets `navigate(href: Href): Promise<void>`. It resolves when the new route is rendered and its loaders have settled, the same quiescence `fire` waits for. `replay` and emitted tests use it, and conformance scripts can navigate without an `<a>` click.
- **The `session` command slot (k.cli).** `stdCommand(name, op)` (`@keel/cli`) fills a command name that k.cli reserves. The only reserved name is `session`. Filling it again with another operation throws E1053, extended to "formatter kind or std command registered twice". `runEngine` answers `session` in three steps:
  1. It runs `importDeps` over the project's manifests, which loads `@keel/std-sessions/tools`.
  2. If the slot is filled, it parses argv with the slot's input schema and runs it.
  3. Otherwise it reports I1055, as it does today.

  The operation is a normal `Operation` plus `run(input, io)`. It is served on all three surfaces, so `keel mcp` lists a `session` tool only in a project that depends on std-sessions. This is a closed slot whose names k.cli lists, not a seventh extension point: a stdlib package cannot add a command name.
- **Fetch options (`@keel/cli` types only).** `Io.fetch(url, init?)` gains `init` so `ingest` can send a cookie. The spec text is unchanged.

### 3. The `session` capability (gap 7)
```ts
// @keel/std-sessions/session: register("session", { real, shell, sim }) (k.ctx); the accessor
export const session: (ctx: Ctx) => SessionSink;
export interface SessionSink {
  /** real: POST JSON (`keepalive`), ok on 2xx, else err; shell: ok(null), no request; sim: ok(null), kept. */
  put(url: URL, session: Session): Promise<Result<null, KeelError<"sessions.putFailed", { status: number }>>>;
  /** sim: every put on this ctx, oldest first; real and shell: []. */
  taken(): readonly { readonly url: URL; readonly session: Session }[];
  /** A fresh `random.id("Session")` from the capability's own ctx: real (crypto), shell real, sim seeded by its derived seed. */
  id(): Id<"Session">;
}
```
- **Real.** `put` calls the global `fetch`. Capability factories get `{ seed }`, not a ctx, so `ctx.net` is out of reach, and E1601 governs app code, not stdlib code. A network failure is `status: 0`.
- **Same origin.** The upload URL must be same-origin. k.server requires same-site proof on writes, and a cross-origin JSON POST needs CORS, which `createApp` does not serve (Known limits).
- **Ids.** `id()` keeps the session id off the app's random stream. A replay never mints an id, so the app's ids line up between a live sim run and its replay. Real sessions get distinct ids per browser even though most real ctxs have seed 0.

### 4. `record` (gaps 1, 2)
```ts
// @keel/std-sessions/record
export function record(ctx: Ctx, options?: RecordOptions): Recorder;
export interface RecordOptions { readonly limit?: number /* 500 */; readonly upload?: URL }
export interface Recorder {
  events(): readonly SessionEvent[];                    // redacted, oldest first
  errors(): readonly KeelError<string, JsonValue>[];    // every `error` event's error, unredacted, in order
  stop(): Session;                                      // ends recording; later calls return the same Session
}
```
- **One per ctx.** A second `record(ctx)` while one is active returns the active recorder and ignores its options. `stop()` releases the ctx.
- **Inert without a document.** With no global `document` (a server render), `record` returns a recorder that records nothing. Browsers and happy-dom tests record.
- **Base.**
  - The base is `at`, `route` and `state`. It is the ctx's current route when `record` starts, else the first `nav` observed.
  - `state` is every live store's state at that moment (`store.snapshot().state`, by id), taken before the route's loaders run.
  - The base `nav` is not an event: `events` hold what came after it.
  - Under the harness, `record` comes before `renderRoute`, so the base is the first navigation. In a browser, `record` runs in a component after mount, so the base is the current route and its loaded state. Section 6 covers what that means for replay.
- **Sources and order.**
  - `nav`, `fire`, `resource` and `error` come from `observe`.
  - `tx` comes from a reactive scope that `record` owns. An effect reads `stores()` and each store's `log()`, and emits the entries newer than the last id seen. Its payload is encoded with `store.payloads.get(name)`.
  - Before `record` appends an observed event, it reads the logs first. A transaction committed before a navigation is therefore listed before it, even when the effect has not yet flushed.
  - `at` is `ctx.clock.now()` when the event is appended.
- **Redaction (gap 1).**
  - **Config.** `record` reads `stdConfig(ctx, "@keel/std-sessions", SessionsConfig)` and merges every module's `redact` list. A test binds config the rfc:0069 way, with `bindStd(ctx, { "@keel/std-sessions": { cart: { redact: [...] } } })` before `record`. No new option is added.
  - **Entry grammar.** An entry is `<subject>:<target>#<path>`. The path is dot-separated and `*` matches one array index.
  - **Subjects.** `tx:<transaction name>#<payload path>` uses the schema from `store.payloads`. `store:<store id>#<state path>` uses `store.schema`, and applies to `state` and to snapshots in the base. `route:<route id>#params.<k>|search.<k>` uses the schemas carried by the `nav` event; the recorder rewrites the `href` from the event's path pattern and sorted search. `el:<element id>#value` applies to `fire` input values. `error:<code>#data.<path>`: error codes have no registered data schema.
  - **Replacement values.** A schema-backed value becomes `gen` of the field's schema, seeded by `fnv(seed, entry, path)`, so the payload still parses. An `el:` or `error:` string becomes `x` repeated to its length, a number becomes 0, a boolean `false`, anything else `null`.
  - **Secrets.** An `s.secret` field is always replaced with a generated inner value. Encoding gives the `"[secret]"` marker, which fails `parse` (k.schema), so the payload would not parse otherwise. Password inputs are already masked by the observer.
  - **Copies.** Redaction applies to `events()`, `stop()` and uploads. `errors()` and the fingerprint use the unredacted error.
- **Overflow (gap 2).**
  - **Cut.** When an append makes `events` longer than `limit`, the buffer drops every event up to and including the oldest buffered `nav`, and rebases `route`, `at` and `state` to that navigation. The state is the snapshot `record` took when that `nav` was observed: it keeps one snapshot per buffered `nav`.
  - **No `nav` buffered.** The buffer drops all events and rebases to the current route and the current state.
  - **Bound.** After any cut a session holds at most `limit` events.
- **Upload.** With `upload`, the first `error` event makes `record` call `session(ctx).put(upload, <session so far>)` once. Recording continues.
- **Live section.** `record.ts` registers inspector hook `sessions.live` (schema: `Session` or `null`). Its `read(ctx)` returns the active recorder's session so far, without stopping it. `keel session capture` reads it.

### 5. Session shape and fingerprint (gap 3)
```ts
type Session = { v: 1; id: Id<"Session">; seed: number; at: number; route: { id: string; params: JsonObject; search: JsonObject };
  state: { [storeId: string]: JsonValue }; events: SessionEvent[]; error: KeelError | null; fingerprint: string };
```
- **New field.** `at`, the base time, is new. Without it, a rebased session replays its events against a clock that starts at 0.
- **Registration.** `Session` is registered as `sessions.Session`. `seed` is `seedOf(ctx)`. `id` is `session(ctx).id()`, drawn at the base and drawn again at each rebase.
- **`error`.** The first error event's error, else `null`.
- **`fingerprint`.** The first 12 hex characters of `sha256(code + "\n" + at + "\n" + routeId)`, computed before redaction.
  - With an error, `code` is its `code`. `at` is `data.at` when that is a string (for `keel.unexpected`, the element id where the throw surfaced, k.errors), else `""`. `routeId` is the route current when the error occurred.
  - With no error, the inputs are `""`, `""` and `route.id`.
  - `record` and `replay` compute it the same way.
  - `sha256` is a synchronous in-package implementation (`internal/sha256.ts`, about 0.8 kB gzip). `stop()` is synchronous and `crypto.subtle` is not.

### 6. `replay` (gaps 2, 3, 6)
```ts
// @keel/std-sessions/replay
export function replay<M extends Readonly<Record<string, RouteDef>>>(session: Session, options: { readonly routes: Manifest<M> }): Promise<ReplayResult>;
export interface ReplayResult {
  readonly observed: readonly SessionEvent[];                  // tx, resource, error events of the replay
  readonly state: { readonly [storeId: string]: JsonValue };   // the harness state() at the end
  readonly error: KeelError<string, JsonValue> | null;          // the replay's first error
  readonly reproduced: boolean;                                // replay fingerprint === session.fingerprint
  readonly unapplied: number | null;                           // 0-based index in `events` of the input it stopped at; -1: the base
}
```
1. **Ctx.** `replay` creates `createCtx({ mode: "sim", seed })`, binds no std config, and advances the clock to `at`.
2. **Base.** It runs `renderRoute(route.id, { routes, params, search, state, ctx })`. `params` and `search` are decoded with the route's schemas. `state` maps each live store whose id is in `session.state` to that value; ids with no live store are skipped. A `route.id` absent from `routes` stops the replay with `unapplied: -1`.
3. **Events.** For each event in order, `replay` advances the clock to the event's `at`.
   - Inputs are applied. A `fire` calls the harness `fire(id, event)`. A `nav` re-derives a typed `Href` by matching the href's path and search against `routes` (no cast, rule 6), then calls `navigate`.
   - A `fire` whose id no rendered element has, or a `nav` that matches no route, stops the replay with `unapplied` set to that index.
   - `tx`, `resource` and `error` events are not applied. The replay's own observations come from a recorder that `replay` runs on its ctx.
4. **Result.** `reproduced` is fingerprint equality, so an error-free session reproduces when its replay ends error-free (gap 3). `state` is the harness `state()`.

Two notes on exactness:
- Replay is exact for a session recorded under sim from its first navigation, which is what the conformance fixtures do.
- A browser session's base is a loaded route. Replay re-runs that route's loaders on the loaded state. A loader whose transactions replace state (the k.services `hydrate` pattern) replays the same. One that appends replays twice (Known limits).

### 7. `minimize` (gap 4)
```ts
// @keel/std-sessions/minimize
export function minimize<M extends Readonly<Record<string, RouteDef>>>(session: Session,
  options: { readonly routes: Manifest<M>; readonly maxRuns?: number /* 200 */ }
): Promise<Result<{ session: Session; runs: number; minimal: boolean }, KeelError<"sessions.notReproduced", { fingerprint: string }>>>;
```
- **Inputs.** An input event is a `fire` or a `nav`. Everything else is an observation.
- **Algorithm.**
  1. Replay the session. If it does not reproduce, return `err`, which the CLI reports as E2004.
  2. Find the shortest reproducing prefix of the inputs by binary search on its length.
  3. Run ddmin over that prefix: try complements of n chunks, n from 2 doubling to the input count, then each single removal, in index order.
  4. Repeat until no single removal reproduces (`minimal: true`) or `runs` reaches `maxRuns` (the smallest reproducing set found so far, `minimal: false`).
- **Output session.** It keeps `id`, `seed`, `at`, `route` and `state`. Its `events` are the kept inputs, at their original `at`, merged by `at` and then by order with the observations of their final replay. `error` and `fingerprint` come from that replay.
- **Determinism.** Every replay is deterministic under the seed and the candidate order is fixed, so two runs are byte-equal.

### 8. Commands and output (gaps 4, 6)
- **Operation.** `session` takes the input `{ op: "capture" | "ingest" | "replay" | "minimize" | "to-test", target?: string, failing?: boolean, since?: number, "max-runs"?: number }` plus the common flags. Its positional fields are `["op", "target"]`. Its file scope is the project: manifests, `topology.ts`, each module's `routes.ts`, `.keel/*.json`, and the target file.
- **`capture [url]`.** It fetches the inspect document (default `http://localhost:5173`, E1056 rules as `keel inspect`), takes `sections["sessions.live"].value`, and writes `.keel/sessions/<fingerprint>-<id>.json`. A `null` value writes nothing and emits only the summary, exit 0: a dev app that is not recording is not an error, and no new code is needed.
- **`ingest <url> [--failing] [--since t]`.** It sends `GET <url>/sessions/list?failing=1&since=<t>` with `accept: application/json`. When `KEEL_SESSIONS_TOKEN` is set, its value goes in the caller cookie (`__Host-keel-caller` for https, else `keel-caller`, k.server). The command reads `results["sessions.list"]` as `ok(Archive)` and writes each session as `.keel/sessions/<fingerprint>-<id>.json`. A 403 or a non-2xx response is E1056, as for `inspect`.
- **`replay <f>`, `minimize <f>`, `to-test <f>`.**
  - **Parse.** Each parses `<f>` with `sessions.Session` (failure: E2002).
  - **Deployable.** Each finds the deployable serving `route.id`: the `topology.ts` deployable whose modules include the route id's module prefix. With none, the result is E2003 naming the base.
  - **Run.** Each runs inside the project's `keel test` runner, with the same vitest start, `KEEL_TEST=1` and the project's `vitest.config` environment, against that deployable's route table: the union of its modules' `routes` (`manifest({ ...a.routes, ...b.routes })`, as the client entry builds it). App code runs only where `keel test` already runs it.
  - **Job file.** The mechanism is backlog 0094's to choose. The candidate is a job test file that `@keel/std-sessions/tools` writes under `.keel/sessions/` with the session path and the routes files, read back through a result file, and removed afterward.
  - **`replay`.** It emits one `session` record and the diagnostics below.
  - **`minimize`.** It rewrites `<f>` (one write through `io.apply`) and emits a `session` record with `file: <f>`.
  - **`to-test`.** It writes `modules/<m>/test/session-<fingerprint>.test.ts`, where `<m>` is `route.id` up to its first `.`, and emits a `session` record with `file` set to that path.
  - **Stop on E2004.** `minimize` and `to-test` write nothing unless the session reproduces.
- **Emitted test.** Straight-line, no loops or helpers:

  ```ts
  // Session: 7f3a9c01d2e4, seed 0
  import { createCtx } from "@keel/ctx";
  import { record } from "@keel/std-sessions/record";
  import { renderRoute } from "@keel/testing";
  import { expect, test } from "vitest";
  import { cart } from "../cart.ts";
  import { routes } from "../routes.ts";

  test("session 7f3a9c01d2e4", async () => {
    const ctx = createCtx({ mode: "sim", seed: 0 });
    ctx.clock.advance(1200);
    const rec = record(ctx);
    const h = await renderRoute("cart.show", { routes, params: {}, search: {}, state: [[cart, { items: [], card: "" }]], ctx });
    ctx.clock.advance(40);
    await h.fire("cart.add", { type: "click" });
    await h.navigate(routes.href("cart.show"));
    await h.fire("cart.checkout", { type: "click" });
    expect(rec.errors()).toEqual([]);
    h.dispose();
  });
  ```

  - **Imports.** Each store in `state` is imported by its id `<module>.<name>` from `modules/<module>/<name>.ts` (k.store ids, principle 3). Routes are imported from each serving module's `routes.ts`. A `nav` is written as `routes.href(id, params, search)` with literal arguments, so a changed route schema fails `tsc`, not the replay.
  - **Clock.** A clock `advance` appears only where `at` changes.
  - **Checks.** Test files are outside the module checks (k.module), so importing `@keel/std-sessions/record` from a module whose `deps` lack it is not E1152.
- **Record kind `session`** (docs/OUTPUT.md, registered by `tools.ts`):

  ```ts
  SessionRecord = s.object({ kind: s.literal("session"), id: s.string(), fingerprint: s.string(), route: s.string(),
    events: s.int(), inputs: s.int(), error: s.string().nullable(), file: s.string().nullable() }, { closed: true })
  ```

  `route` is the base route id, `events` and `inputs` are counts, `error` is the code, and `file` is the path read or written. Compact: `7f3a9c01d2e4 orders.show 42 events orders.locked`, with `ok` in place of a null `error` and ` -> <file>` appended when the command wrote one. Pretty adds the inputs count and the file on a second line.
- **Diagnostics (gap 6).** E2002-E2004 are `diag` records at `path: <f>`, `line: 1`, `col: 1`, `see: "std.sessions"`, and the exit code is 1. Session files are machine-written JSON, so a position inside the file is not useful. Messages:
  - E2002 `session file fails sessions.Session at <path>: <rule>`
  - E2003 `input event <N> (<kind>) does not apply: <id or href>`; for the base, `base route <id> is not served`. N counts from 0 over `events` (observations included), as `unapplied` does.
  - E2004 `replay fingerprint <x> differs from <y>`

  E2003 needs no `ids.json`: replay checks the rendered DOM, which is what the harness `fire` does without artifacts. That removes the open question of how `ids.json` reaches the command.

### 9. Ingest (gap 5)
```ts
// @keel/std-sessions/routes: literal (E1005, routes.json)
export const routes = manifest({
  "sessions.ingest": { path: "/sessions", actions: { POST: ingestSession }, component: SessionsView },
  "sessions.list": { path: "/sessions/list", search: ListSearch, loader: listSessions, component: SessionsView },
});
// ListSearch = s.object({ failing: s.boolean().optional(), since: s.number().optional() })
// Archive    = s.record(s.object({ count: s.int(), first: s.number(), last: s.number(), sessions: s.array(Session) }))  // key: fingerprint
```
- **`ingestSession`.**
  - **Input.** `action({ input: Session, stores }, fn)`. An input whose encoded JSON is over 262,144 bytes returns `err` with `keel.payloadTooLarge` (413), on top of the server's `maxBodyBytes`.
  - **Fingerprint.** The action recomputes the fingerprint from `error` and the error's route, and stores that value, so a client cannot file one bug under another's fingerprint.
  - **Store.** It restores the `sessions.archive` store from `ctx.storage` key `sessions.archive`, applies `tx(addSession, session)`, and writes the snapshot back. This is the request-scoped `stores` pattern golden-1's `api.board` uses.
  - **`addSession`.** It updates `count`, `first` and `last`, and keeps the newest 5 `sessions` by `at`. At more than 64 fingerprints it evicts the one with the oldest `last`. Invariant `sessions.capped` holds both bounds.
  - **Invalid input.** It is 422 `keel.fields` (k.forms decoding).
- **`listSessions` (reader access).**
  - **Output.** `loader({ output: Archive, search: ListSearch }, fn)` returns the archive filtered by `failing` (error not null) and `since` (`last >= since`).
  - **Who may read.** Access is decided in the loader, not a guard. A guard sees only `{ url }` and `ctx` (k.router); `caller` reaches loaders. The loader returns `err(keel.denied)` (403) unless `caller` is in the merged `readers` lists of the deployable's module configs. An absent or empty list denies everyone.
  - **Tokens.** An operator gets a token by making one write to the ingest service, then takes the minted caller cookie as the Action's `token` and adds its hash to `readers`. The hash is `caller`, the base64url SHA-256 of the cookie token (k.server).
  - **Exposure.** `readers` holds hashes of server-signed tokens, and a hash cannot be turned back into a cookie. Since std.sessions config is `clientStd`, the hashes appear in island documents of the ingest deployable (THREAT-MODEL diff).
- **E2005.** A deployable whose adapter is not `node` and one of whose modules' `routes.ts` imports `@keel/std-sessions/routes` is E2005, at that import. Recording (`record`) in a `client` deployable is clean: the conformance fixture had treated any std-sessions dependency as E2005, which contradicts browser recording.

### 10. Check rules E2001, E2005 (`@keel/std-sessions/tools`)
- **E2001** reads each app `module.ts` `std['@keel/std-sessions'].redact` literal. It reports at the string literal, with a fix that deletes that array element (and its comma). Three cases are reported:
  - an unknown subject;
  - a target whose module prefix (up to the first `.`) is not the manifest's `id`;
  - a path absent from the target's schema.
- **Schema resolution.** It is static and follows the k.check resolver. A `transaction(<store>, '<name>', <schema>, fn)` call, a `store(<schema>, ...)` with its `id`, a route's `params`/`search` in `routes.ts`, and an `s.object({...})` literal are found in the module's files, following same-module `const`s and `<Name>.schema.ts` imports. A schema that does not resolve statically is not reported: the rule reports only what it proves. `el:` checks only the id prefix, and `error:` checks the `s.error(code, data)` literal when one exists.
- **E2005**, as above, has no fix: moving a module between deployables is the author's choice.

### 11. GitHub Action (0095)
- **Definition.** `packages/std-sessions/action/action.yml` is a composite action with inputs `url` and `token`. `token` is exported as `KEEL_SESSIONS_TOKEN`.
- **Steps.**
  1. Run `keel session ingest <url> --failing --since <now - 26h>`.
  2. For each fingerprint, run `keel session replay` on its newest file.
  3. When it reproduces, run `minimize`, then `to-test`, then open or update one issue labeled `keel-session` titled `session <fingerprint>: <code> at <route>`. The title prefix `session <fingerprint>:` is the lookup key. The body holds the compact `session` record and the emitted test in a fenced block.
  4. When it does not reproduce, add one comment to that fingerprint's open issue, if there is one.
- **Permissions.** It needs `issues: write` only and never pushes.

### Gap resolution summary
| Gap | Resolution |
| --- | --- |
| 1 redact under sim | `bindStd(ctx, …)` before `record` (rfc:0069 item 7); no new option |
| 2 overflow, navigate | no `nav` buffered: drop all, rebase now; base holds route and state; harness `navigate(href)` (k.testing) |
| 3 replay result | `state` added; `reproduced` is fingerprint equality, so error-free reproduces error-free; `unapplied` |
| 4 minimize, to-test | inputs are `fire` and `nav`; `minimize` rewrites `<f>`; library `minimize`; buggy fixture project `cart-bug` and fix overlay; `run(["test"], …)` on a disk copy |
| 5 ingest | `@keel/std-sessions/routes`; `listSessions` checks `caller` against config `readers`; `Archive` shape |
| 6 E2002-E2004 | `diag` at the file, 1:1; N is 0-based over `events`; no `ids.json` |
| 7 `taken()` | `readonly { url: URL; session: Session }[]`, sim only, oldest first |

## Alternatives
- **Taps on inspector hooks.** Inspector sections are pulled once per inspect request (RFC 0042), so events between pulls would be lost. Pushing events through them would change a frozen-shape extension point.
- **A global event bus in `@keel/ctx`.** Parallel tests and request-isolated servers would mix events. Keying observers by ctx keeps a test's events inside its ctx.
- **A store commit listener (`onCommit(fn)`) instead of reactive `stores()`.** It is a second way to watch a store, beside `log()`, which is already reactive (principle 1).
- **Expose `Transaction` objects on the store.** Any holder could call `tx` with them and slip past E1301's static view. `payloads` exposes schemas only.
- **`ctx.seed` field.** It changes the `Ctx` shape for a stdlib need, which RFC 0066 declined to do for `ctx.std`.
- **Mint the session id with `ctx.random`.** The draw moves the app's random stream, so ids the app mints in a replay differ from the live run. A private ctx inside the capability keeps the one-way rule (`random.id`) and leaves the stream alone.
- **A `node` export condition for the tooling half.** A node server that imports the package root would load `@keel/check` and `typescript`, and the ingest service is one. A `./tools` subpath is explicit.
- **Run replay in-process through Vite's SSR loader.** `keel render` has the same gap ("needs a compiled component or route loader"). A second app-code loader would run app code under a different transform and environment than `keel test`, so a session could reproduce in one and not the other.
- **Put `sessions.list` behind an app guard, as the spec had it.** A guard sees only the URL, and route manifests must be literal (E1005), so a package route cannot take an app guard. An app-owned list route would leave the package without a tested list endpoint.
- **A synthetic `nav` event at an overflow with no navigation.** Replay would apply it as an input and re-run loaders the live app never ran at that moment.
- **Count N from 1.** `unapplied`, array indices and the conformance property all count from 0.
- **FNV-1a for the fingerprint.** It is smaller and synchronous, but the spec named sha256 and the cost is 0.8 kB once.

## Spec diff
Measured as `ceil(chars / 4)`, the rule `tooling/budgets.mjs` uses.

### std.sessions (1,498 -> 1,495)
The section is replaced by the text below. Non-normative words were cut to fit:
- the Output paragraph moved to docs/OUTPUT.md;
- the Artifacts paragraph became Action, without the issue title (§11 keeps it);
- the `SessionEvent` type is reflowed onto two lines;
- the second redact example and the `(k.module)`/`(k.ctx)` back-references are dropped.

````md
# std.sessions: Sessions
status: proposed

**Module.** `@keel/std-sessions` ships a stdlib manifest `{ id: 'sessions', capabilities: ['clock', 'session', 'storage'], public: { exports: ['record', 'replay', 'minimize', 'session', 'Session', 'routes'], routes: ['sessions.ingest', 'sessions.list'] } }`. Each app module lists redactions (`clientStd`; tests: `bindStd`): `std: { '@keel/std-sessions': { redact: ['tx:cart.pay#card.number'] } }`.
Subjects: `tx:` transaction name (payload), `store:` id (state), `route:` id (`params.*`, `search.*`), `el:` element id (`value`), `error:` code (`data.*`). A redacted value becomes its schema's generated value (seed: session seed and path); `el:` and `error:` strings become `x` repeated. `s.secret` fields and password inputs (k.ctx) are always redacted.

**API.** `register('session', { real, shell, sim })` gives `session(ctx)`: `put(url, s): Promise<Result<null, KeelError>>` (real: POST, non-2xx `sessions.putFailed`; shell: drop; sim: kept in `taken(): { url, session }[]`, `[]` elsewhere) and `id()`, a `random.id('Session')` on its own ctx (sim: its derived seed). `record(ctx, { limit = 500, upload?: URL })` returns `{ events(), errors(), stop(): Session }`, one per ctx (again: the same; inert without `document`); with `upload` it puts the session on the first `error`.
```ts
type SessionEvent = { at: number } & ({ kind: 'tx'; store; name; payload: JsonValue } | { kind: 'nav'; href: Href }
  | { kind: 'resource'; id; state: 'loading' | 'ready' | 'error' } | { kind: 'fire'; id; event: TestEvent } | { kind: 'error'; error: KeelError })
type Session = { v: 1; id: Id<'Session'>; seed: number; at: number; route: { id; params; search }; state: { [storeId]: JsonValue }; events: SessionEvent[]; error: KeelError | null; fingerprint: string }
```
The base (`at`, `route`, `state`) is the ctx's route when `record` starts, else its first `nav`. `tx` comes from each store's `log()`, the rest from `observe` (k.ctx); `at` is `ctx.clock.now()`, `seed` is `seedOf(ctx)`, `id` is `session(ctx).id()`, drawn at the base. `Session` is `sessions.Session`; `error` is the first. `fingerprint`: 12 hex of sha256(`code`, `data.at`, route id then) of the first error, before redaction (none: `''`, `''`, `route.id`). Past `limit` events the buffer drops through its oldest `nav` and rebases there (none: drops all, rebases now).

`replay(session, { routes })` under a sim ctx of `seed` advances the clock to `at`, runs `renderRoute` on the base, then per event advances to `at` and applies inputs (`fire`, `nav`); the rest are observations. Returns `{ observed, state, error, reproduced, unapplied }`: final `state()`; `reproduced` iff fingerprints match; `unapplied` the 0-based index of the input it stopped at, else `null`. `minimize(session, { routes, maxRuns = 200 })`: delta debugging over inputs (shortest reproducing prefix, then subsets) until removing any one loses the fingerprint (at `maxRuns`: smallest found); it keeps the base, with its replay's observations.

**Commands** (k.cli `session`, via `stdCommand`; record kind `session`, docs/OUTPUT.md). `capture [url]` saves a dev app's live session (inspect section `sessions.live`) · `ingest <url> [--failing] [--since t]` fetches `sessions.list` (cookie `KEEL_SESSIONS_TOKEN`) to `.keel/sessions/<fingerprint>-<id>.json` · `replay <f>` · `minimize <f> [--max-runs 200]` rewrites `<f>` · `to-test <f>` writes `modules/<route module>/test/session-<fingerprint>.test.ts`: header `// Session: <fingerprint>, seed <n>`, straight-line harness calls under that seed, ending `expect(rec.errors()).toEqual([])`. The last three run under `keel test` on the routes of the deployable serving `route.id`.

**Ingest.** `routes`: `sessions.ingest` (`POST /sessions`, input `Session`, over 256 KiB 413) re-fingerprints and applies `tx(addSession)` to store `sessions.archive` in `ctx.storage` (`Archive`: per fingerprint `count`, `first`, `last`, newest 5; at most 64, oldest `last` evicted; invariant `sessions.capped`); `sessions.list` (`/sessions/list`, search `{ failing?, since? }`) loads it for a `caller` in config `readers`, else 403.

**Action.** `@keel/std-sessions/action` (inputs `url`, `token`) runs nightly `ingest --failing` and `replay`; per reproduced fingerprint, `minimize`, `to-test` and one `keel-session` issue. It never pushes.

**Rules.** E2001 `redact` entry with an unknown subject, a subject of another module, or a path absent from its schema (check; fix removes it) · E2002 session file fails `sessions.Session` · E2003 replay cannot apply input N or the base (absent `fire` id, unmatched `nav` href or `route.id`; message names it) · E2004 replay fingerprint differs (`minimize`, `to-test` stop) · E2005 a non-`node` deployable serves `routes` (check). E2002-E2004 are `keel session` `diag` records at the file, 1:1.

**Conformance.**
- Under one sim seed, one script of fires produces byte-equal sessions; events are in occurrence order with `at` equal to `ctx.clock.now()` then.
- A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema.
- After overflow, a session holds at most `limit` events and its replay ends in the same `state()` as the live app.
- Replaying an unmodified session reproduces every store's final state and its fingerprint.
- `minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal.
- The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied.
- A valid POST to `sessions.ingest` is listed by `sessions.list` under its fingerprint; invalid input is 422 `keel.fields`; a sixth session of one fingerprint keeps 5 and counts 6; a caller not in `readers` gets 403.
- The `session` capability has all three implementations; shell `put` returns `ok(null)` and sends nothing.
- Each of E2001-E2005 has a fixture that triggers it and a clean counterpart.
````

Clause changes against the current section:
- Clause 3 drops "starts at a navigation". The base is a navigation's route, but with no `nav` buffered the rebase is to the current route, and the clause now says what holds in both cases.
- Clause 7 appends the `readers` case.

### k.ctx (1,152 -> 1,406)
- **API.** A paragraph is inserted before **Rules.**:
  > **Observers** (rfc:0070). `observe(ctx, fn): () => void` calls `fn` synchronously with each event the kernel reports on `ctx`, in order, until the returned function runs; a throw in `fn` is dropped. Events: `{ kind: 'nav', href, route: { id, path, params, search, schemas } }` when the router starts a navigation (a new observer first gets the current one); `{ kind: 'fire', id, event }` when runtime-dom dispatches a `FireEvent` (k.testing `TestEvent`) to element `id`, before its handlers (a password `input` value is `x` repeated); `{ kind: 'resource', id, state }` when `Match` renders a resource state (`id`: its `inspect()` node id); `{ kind: 'error', error }` when a `Boundary` catches or a loader or action returns `err`. `seedOf(ctx)` is the seed `createCtx` was given (default 0).
- **Conformance** adds, after "Every capability has all three implementations.":
  > Under a sim ctx, a navigation, a `fire`, a resource settling and a `Boundary` catch each reach `observe` once, in order; an observer added after the first navigation gets it first, and none after its stop function runs.
- **Map.** The k.ctx row gains `observers`.

### k.store (1,361 -> 1,412)
- "`stores()` returns the live stores by id." becomes "`stores()` returns the live stores by id; an effect reading it reruns when one joins or leaves."
- "A store exposes readonly `schema` and `id`;" becomes "A store exposes readonly `schema`, `id` and `payloads` (each transaction's payload schema by name);"
- Conformance adds, after "A duplicate live id throws.": "An effect reading `stores()` reruns when a store is created and when its scope is disposed."

### k.testing (1,448 -> 1,490)
- "`renderRoute` handles have it too." becomes "`renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready."
- Conformance adds, after the `settle()` clause: "`navigate(href)` on a `renderRoute` handle resolves with the new route rendered and its loaders settled."

### k.cli (1,492 -> 1,495)
- "`session` is reserved for the stdlib sessions module; without it the kernel reports I1055 (info, exit 0)." becomes "`session` runs the operation std.sessions fills with `stdCommand('session', op)` (`@keel/cli`), after importing the project's std `deps`; unfilled, I1055 (info, exit 0)."
- Rules: "E1053 formatter kind registered twice" becomes "E1053 formatter kind or std command registered twice".
- Trims, non-normative: "(principle 6)" in the `inspect` row, "(extension point, RFC 0042)" becomes "(extension point)", and "The viewer is the Keel app `apps/inspector`." is dropped. The inspector app's README already says so.

### k.module (1,499 -> 1,499)
- "import each `@keel/std-*` package in an app module's `deps` once," becomes "import each `@keel/std-*` package in an app module's `deps` once (and its `./tools` export, if any),".
- Trims, non-normative: "(`importDeps`, `@keel/compiler/std/importDeps`)" becomes "(`@keel/compiler/std/importDeps`)", "**Std config** (rfc:0066)." becomes "**Std config.**", and "(rfc:0069)" after "Browsers get only client-readable config" is dropped. The RFC links live in the ADR index.

### docs/OUTPUT.md (not a spec section)
- The JSON paragraph's list of record kinds gains `session`.
- One line is added after it: "`session` (std.sessions): `{ kind, id, fingerprint, route, events, inputs, error, file }`; compact `7f3a9c01d2e4 orders.show 42 events orders.locked`, `ok` for no error, ` -> <file>` when one was written."
- The diagnostic-shape line already lists `session`.

### docs/THREAT-MODEL.md (diff)
One **Sessions** bullet:
- `record` keeps transaction payloads, store state and input values, except the module's `redact` paths, `s.secret` fields and password inputs. A module that records must list the user data it holds.
- Uploads are same-origin JSON POSTs, under the k.server write proof.
- `sessions.ingest` takes unauthenticated posts, at most 256 KiB each, 5 per fingerprint and 64 fingerprints. Fingerprints are recomputed on the server.
- `sessions.list` answers only `caller` hashes in config `readers`. These hashes reach island documents, since the config is `clientStd`, and a hash is not a credential.
- `to-test` and the Action copy unredacted-by-default values into a test file and an issue body. In a public repository those values become public.

## Conformance diff
Seed 1337 throughout. "0092", "0093" and "0094" name the task that unskips a file.

### Edited (rfc:0070), `packages/std-sessions/conformance/`
- **`fixtures.ts`.**
  - Transaction names become `"cart.add"` and `"cart.pay"`, since the `tx:` subject is the logged transaction name (E1155 convention).
  - `play(seed, script, { limit?, redact? })` calls `bindStd(ctx, { "@keel/std-sessions": { cart: { redact } } })` before `record`.
  - `Step` gains `{ nav: true }`, played as `h.navigate(cartRoutes().href("cart.show"))`, and `stepArb` includes it.
  - New `buggyRoutes()`: a second route table whose component adds a `cart.checkout` button built with `@keel/ui` (`Button` with `onClick`), so its handler runs through the delegated table and a `Boundary` catches. The handler reads `card.number.length` from a payload built only when the card is non-empty, so it throws `keel.unexpected` at `cart.checkout` exactly when the cart has items and the card is empty.
  - New `buggySession()`: records the script `add, card "x", card "", nav, add, checkout` on `buggyRoutes()`. It has 6 inputs, and its 1-minimal sets have 2 (`add, checkout`).
  - The gap comment is removed. `cartModuleFiles` names the transaction `'cart.pay'`.
- **`redaction.test.ts`.** It passes `redact: ["tx:cart.pay#card.number"]` to `play` and filters `e.name === "cart.pay"`. The gap comment goes. Unskipped by 0092.
- **`overflow-rebase.test.ts`.** The header quotes the new clause 3. The first test asserts `session.events.length <= limit`, replacing `limit + 1` and the first-event `nav` check. The gap comment goes. Unskipped by 0092.
- **`replay-reproduces.test.ts`.** Only the gap comment is removed. The assertions already match `state` and `reproduced`. Unskipped by 0092.
- **`deterministic-sessions.test.ts`, `capability.test.ts`.** Unchanged. Unskipped by 0092.
- **`E2001-redact-path.test.ts`.** It imports `@keel/std-sessions/tools` in place of the package root. Unskipped by 0092.
- **`E2005-adapter-not-node.test.ts`.**
  - It imports `@keel/std-sessions/tools`.
  - The fixture adds `modules/cart/routes.ts`, which imports `{ routes } from "@keel/std-sessions/routes"` and spreads it.
  - A new clean case: a `client` deployable whose module only imports `@keel/std-sessions/record` reports no E2005.
  - Unskipped by 0092.
- **`E2002-session-file-schema.test.ts`.** It imports `@keel/std-sessions/tools`. The gap comment goes. The clean case stays in memory: with no `topology.ts` it reports E2003 for the base, never E2002. Unskipped by 0094.
- **`E2003-replay-input.test.ts`.**
  - The property moves to the library: `replay({ ...session, events }, { routes: cartRoutes() })` gives `unapplied === n` for the `fire` at index n, `unapplied === 0` for a `nav` to `/nowhere`, and `null` for the clean session.
  - One CLI example remains on the disk fixture (below): stdout holds `E2003` and `input event 3`.
  - Unskipped by 0094.
- **`E2004-not-reproduced.test.ts`.** The three cases run on a disk copy of `fixtures/cart-bug/`. `minimize` and `to-test` leave `writes` empty. The clean case uses the recorded `buggySession()`, whose fingerprint reproduces. Unskipped by 0094.
- **`minimize.test.ts`.**
  - The clause's three assertions run on the library `minimize(buggySession(), { routes: buggyRoutes() })`. The result is `ok`, the minimized session reproduces, removing any one `fire` or `nav` gives `reproduced: false`, and two runs are `JSON`-equal.
  - One CLI case: `keel session minimize sessions/failing.json` on the disk fixture writes `<f>`, and its content equals the library result.
  - Unskipped by 0094.
- **`to-test.test.ts`.** Unskipped by 0094. The test proceeds in five steps:
  1. Copy `fixtures/cart-bug/` to `packages/std-sessions/.tmp/<n>/`. It must sit inside the workspace so `node_modules` resolves (gitignored, removed after), the same pattern `tooling/budgets.mjs` uses for `check.injected10`.
  2. Write `sessions/failing.json` from `buggySession()`.
  3. Run `run(["session", "to-test", "sessions/failing.json"], { cwd, files, apply })`, then `check([...projectFiles, emitted])` with 0 errors.
  4. Run `run(["test", emittedPath], { cwd, files })` and expect code 1.
  5. Copy `fixtures/cart-bug.fix/modules/cart/CartPage.ts` over the copy and run again: code 0.
- **`ingest-list.test.ts`.** The `test.todo` lines become tests against `createApp({ routes, ctx: sim, ... })`, with config bound by `bindStd`. The caller is taken from the cookie the first POST mints. Unskipped by 0093.

### Added
- `packages/std-sessions/conformance/fixtures/cart-bug/`: `topology.ts` (`web`, `client`), `vitest.config.ts` (happy-dom), `modules/cart/{module.ts, cart.ts, routes.ts, CartPage.ts}`, the same logic as `buggyRoutes()` as files, and `modules/cart/module.ts` with `deps: ['@keel/std-sessions']`.
- `packages/std-sessions/conformance/fixtures/cart-bug.fix/modules/cart/CartPage.ts`: the fix. The handler guards the empty card and renders a `cart.cardMissing` message.
- `packages/testing/conformance/ctx-observe.test.ts` (k.ctx clause; in `@keel/testing` because it needs router and runtime-dom): a property over scripts of `fire`, `navigate` and resource fixtures that checks one event per occurrence, in order, the current-route replay, and silence after stop. Done by 0092.
- `packages/store/conformance/stores-reactive.test.ts` (k.store clause). Done by 0092.
- `packages/testing/conformance/route-navigate.test.ts` (k.testing clause). Done by 0092.

### Not conformance (unit tests in 0092)
- `packages/std-sessions/test/`: upload (one `taken()` entry on the first error, none for later errors), redaction of each subject, `stop()` idempotence, one recorder per ctx, inert without `document`, the `sessions.live` section, fingerprint vectors, the `session` formatter through `respond` (`@keel/cli/testing`), and `config-registered.test.ts` extended for `readers`.

## Migration
- **Kernel callers.** No existing call changes. `observe`, `seedOf`, `payloads`, `navigate` and `stdCommand` are additions. `stores()` becoming reactive changes only effects that read it, and none exist outside tests. `TestEvent` stays exported from `@keel/testing` as an alias.
- **`@keel/cli` `Io.fetch`.** The new `init` parameter is optional, so existing callers and tests are unchanged.
- **0092 (this RFC's implementation).**
  - Kernel: `observe`, `seedOf`, `report`, and the reports in router, runtime-dom (`fire`, `Match`, `Boundary`) and router loaders and actions; reactive `stores()` and `payloads`; harness `navigate`; `stdCommand`; `importDeps` `./tools`.
  - Package: the capability, `record` and redaction, `Session`, `replay`, the `sessions.live` section, the `session` formatter, E2001, E2005, and the `tools.ts` and package exports.
  - Conformance: unskip as listed above.
- **0093 (ingest service).** It implements `@keel/std-sessions/routes` (`ingestSession`, `listSessions`, `Archive`, store `sessions.archive`, `addSession`, `sessions.capped`) and Keel's own node deployable that serves `routes.routes` behind the app origin. It sets `readers` in its module's `std` and unskips `ingest-list.test.ts`. It needs nothing else from 0092 than the `Session` schema and `SessionsConfig.readers`.
- **0094 (`keel session`).** It implements the `session` operation in `tools.ts`: `capture`, `ingest` (cookie, `Io.fetch` init), `replay`, `minimize` (library and command), `to-test`, the run-under-`keel test` job, and E2002-E2004. It also adds the `cart-bug` fixtures and unskips the E2002-E2004, `minimize` and `to-test` files.
- **0095 (Action).** It implements `action/action.yml` against the command contract in §8 and §11. S1 exits when it closes a real bug in 0093.

## Budgets
- **`@keel/std-sessions`.**
  - The `tooling/budgets.json` entry is `"@keel/std-sessions": "6kb"`, browser platform, measured from `src/index.ts` with dependencies external.
  - Estimate: `record` with redaction about 2.2 kB, `sha256` 0.8 kB, capability 0.3 kB, `Session` schema 0.4 kB, `replay` and `minimize` 1.2 kB, routes and ingest 0.8 kB. That is about 5.7 kB before gzip finds shared code.
  - The browser cost of an app importing only `@keel/std-sessions/record` is about 3.5 kB.
  - `./tools` is node-only and not measured today: `budgets.mjs` measures `src/index.ts` only. A follow-up can map an `@keel/std-sessions/tools` key to `src/tools.ts` at `"8kb"`, node.
- **Kernel, estimates for 0092 to measure.**
  - `@keel/ctx` +0.3 kB (`observe`, `report`, `seedOf`, the current-`nav` slot; budget 3 kB).
  - `@keel/runtime-dom` +0.2 kB (three reports; budget 6 kB).
  - `@keel/router` +0.1 kB (`nav` and `error` reports; budget 8 kB).
  - `@keel/store` +0.15 kB (registry signal, `payloads`; budget 3 kB).
  - `@keel/testing` +0.1 kB (`navigate`; budget 9 kB).
  - `@keel/cli` +0.4 kB (the slot, `importDeps` for `session`, fetch init; budget 22 kB).
  - `@keel/compiler` +0.05 kB (`./tools` in `importDeps`; budget 26 kB, now at 25,959 B, so this may cross it).
  - A budget raised for any of these is recorded as D7 in the handoff with the measured bytes.
- **Output budgets.** `mcp.tools-list` (1,500 tokens) is measured at the repository root. No `module.ts` there lists std-sessions, so the slot stays empty and the tool list is unchanged. In an app with std-sessions, the `session` tool adds about 150 tokens.

## Token impact
std.sessions 1,498 -> 1,495; k.ctx 1,152 -> 1,406; k.store 1,361 -> 1,412; k.testing 1,448 -> 1,490; k.cli 1,492 -> 1,495; k.module 1,499 -> 1,499; spec map +3. Every section stays at or under 1,500.

## Known limits
- **Browser base.** A browser recording's base is a loaded route, so replay re-runs that route's loaders on the loaded state, and a loader that appends instead of replacing doubles its entries.
- **Random ids after a rebase.** After a rebase, ids the app draws with `ctx.random` differ between live and replay: the stream position at the cut is not recorded. Fingerprints still match, since they carry no ids.
- **Same-origin uploads.** `upload` must be same-origin: `createApp` serves no CORS preflight.
- **Redacted inputs replay as replacements.** An `el:` input replays as `x` repeated and a `route:` parameter as its generated value. A bug that depends on the real value does not reproduce.
- **Store ids in emitted tests.** `to-test` imports stores by the `<module>.<name>` id convention. A store whose id breaks it (E1155 off) is left out of the emitted `state`, and the test starts that store from its initial value.
- **Ingest concurrency.** The ingest archive is read, changed and written per request, so two concurrent posts can lose one. Fine at nightly-triage volume, and a store with `ctx.storage` compare-and-set would close it.
- **Static checks.** E2001 does not report paths in schemas it cannot resolve statically (imported from another module, built by a function).

## Open questions (for the user)
1. **Where `keel session` runs app code.** This RFC runs `replay`, `minimize` and `to-test` inside the project's vitest, as `keel test` does. The other way is an in-process Vite SSR loader shared with `keel render`. Accept the test-runner route?
2. **Reader identity for `sessions.list`.** It is a `caller`-hash allowlist in `std` config, which reaches island documents because the config is `clientStd`. Keel has no header-based auth. Is this acceptable for S1, or should k.router guards receive `caller`, a kernel change to a section at 1,498 tokens?
3. **Default-on recording.** The spec redacts by allowlist: everything not listed is recorded. Should `record` instead require each module to declare what it records, and should the Action keep emitted tests out of issue bodies in public repositories?
4. **Kernel surface.** The RFC adds `observe`/`seedOf` (k.ctx), reactive `stores()` and `payloads` (k.store), harness `navigate` (k.testing) and `stdCommand` (k.cli). Accept these, or prefer a different split, such as `payloads` as a function in `@keel/store/internal`?
5. **Server-side `record`.** It is inert without a `document`. Should server renders record instead, per request ctx?
