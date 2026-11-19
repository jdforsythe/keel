# RFC 0070: the @keel/std-sessions module, kernel observers, and the session commands

Status: implemented. Accepted (ADR-0059, accepted 2026-11-09)

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

## Decisions (user, 2026-11-09)
The draft's five open questions were answered in tasks/0092-std-sessions/PLAN.md. This text applies them.

| | decision | where |
| --- | --- | --- |
| D1 | `keel session replay\|minimize\|to-test` run app code through the project's `keel test` runner, the one way Keel loads app code | §8 Run; the Vite SSR loader is under Alternatives |
| D2 | guards receive the caller; `readers` is server-only config, checked by the `sessions.reader` guard | §2 k.router and k.module `keys`; §9 |
| D3 | recording stays on by default; `to-test` and the Action write every `s.string()` value as `x` repeated unless config `expose` names it; passwords and `s.secret` are always redacted | §4 Redaction; §8 `to-test` redaction |
| D4 | the kernel additions stay one RFC, with final signatures and one clause each | §2; Conformance diff |
| D5 | `record` is a no-op on the server | §4 Server |

**D3 marker: `expose`, not a schema annotation.** k.schema has no annotation mechanism. Its options are per primitive (`{ min, max }`, `{ closed }`). `s.string({ public: true })` would add an option that `gen`, `doc`, `encode` and JSON Schema export must all carry, in a section at its budget, for one stdlib consumer. A per-field list in the sessions config, `expose: string[]`, reuses the `redact` entry grammar and E2001's check, and needs no kernel change. It is server-only config: only `to-test` reads it.

The coordinator added one kernel change on 2026-11-09: k.check `RuleInput.project` (§2).

## Amendment (2026-11-09, red-team 0206-0210, 0213)
The red-team pass on the implementation filed six findings. Fixes are in this batch, and they change the contract as follows. Where this list and the sections below disagree, this list holds.
- **Unseeded ctx (0213).** `seedOf(ctx): number | undefined` returns `undefined` for a ctx created without a seed, not 0. A session recorded on one has no `seed` and has `deterministic: false` (`Session` gains `seed?: number; deterministic: boolean`). `replay` runs it under seed 0. Its `reproduced` still means the fingerprints match, but its state may differ from the live run, since the live draws were not seeded. The Action treats a reproduced unseeded session the same way: the emitted test pins seed 0.
- **Sticky password masking (0207).** The observer masks a field for the rest of the ctx once it has had `type="password"` or `autocomplete` `current-password` or `new-password`. Before this fix, a script that flipped `type` to `text` unmasked it.
- **`el:` covers every event kind (0206).** An `el:<id>#value` entry redacts that element's values in every event that carries them, `fire` events and error `data` included, not only `input`.
- **Secret search in `nav` (0208).** `s.secret` search values are redacted in the `nav` event's rebuilt `href`, as in `route.search`.
- **Error messages (0209).** An error's `message` has every redacted value it contains replaced, so a message that quotes a payload cannot carry it out.
- **Overflow keeps the error (0210).** With no `nav` buffered, the appended event is kept when it is an input or an `error`. The error that triggered the cut stays in the session, and so does the fingerprint's source.
- **`observe` is a capability (RFC 0071).** RFC 0071 makes `observe` a declared capability, so a module that calls it lists `observe` in `capabilities` (E1156). The std-sessions manifest lists `clock`, `observe`, `session` and `storage`; RFC 0071 holds the k.ctx and k.module text.

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
  SessionsConfig = s.object({ redact: s.array(s.string()).optional(), expose: s.array(s.string()).optional(),
    readers: s.array(s.string()).optional() }, { closed: true })
  ```

  It stays in `SessionsConfig.ts` with `s.register("@keel/std-sessions", SessionsConfig)`, followed by `clientStd("@keel/std-sessions", ["redact"])` (rfc:0069 with this RFC's `keys`; this closes the `TODO 0092` line there). Only `redact` reaches browsers, where `record` redacts. `expose` (§8) and `readers` (§9) are new and stay on the server.
- **Dependencies.** `@keel/ctx`, `@keel/schema`, `@keel/store`, `@keel/reactive`, `@keel/router`, `@keel/compiler` (subpaths `std/stdConfig`, `std/clientStd`, `inspect/inspector`), and `@keel/testing` (`replay`, `minimize`). `@keel/check` and `@keel/cli` are needed only by `tools.ts`. `tooling/deps.json` appends `std-sessions` after `std-report`.

### 2. Kernel additions
Each addition is small, sits in the section that owns the code, and fits that section's budget (Token impact). The signatures below are final (D4); each addition has one conformance clause in its section, listed with its file in the Conformance diff.

- **Observers and seed (k.ctx).**

  ```ts
  // @keel/ctx
  export type FireEvent =                       // k.testing's TestEvent is an alias of this type
    | { readonly type: "click" } | { readonly type: "input"; readonly value: string } | { readonly type: "change" }
    | { readonly type: "keydown"; readonly key: string } | { readonly type: "submit" } | { readonly type: "focus" } | { readonly type: "blur" };
  export type CtxEvent =
    | { readonly kind: "nav"; readonly href: string; readonly route: {
        readonly id: string; readonly path: string;                       // path pattern, "/orders/:id"
        readonly params: Readonly<Record<string, unknown>>; readonly search: Readonly<Record<string, unknown>>;  // decoded
        readonly schemas: { readonly params?: ObjectSchema<unknown> | undefined; readonly search?: ObjectSchema<unknown> | undefined } } }
    | { readonly kind: "fire"; readonly id: string; readonly event: FireEvent }
    | { readonly kind: "resource"; readonly id: string; readonly state: "loading" | "ready" | "error" }
    | { readonly kind: "error"; readonly error: KeelError<string, unknown> };
  export function observe(ctx: Ctx, fn: (event: CtxEvent) => void): () => void;
  export function seedOf(ctx: Ctx): number | undefined;   // the createCtx seed; undefined when none was given (amendment)
  // @keel/ctx/internal (kernel producers only, not public)
  export function report(ctx: Ctx, event: CtxEvent): void;
  ```

  - **Producers.**
    - The router reports `nav` when a navigation starts, before guards. A guard's own redirect is not a second `nav`.
    - runtime-dom's delegated listener reports `fire` for a `click`, `input`, `change`, `keydown`, `submit`, `focus` or `blur` on an element with an id, before handlers run. On an `<input type="password">` it reports an `input` value, and a one-character `keydown` key, as `x` repeated, so no observer sees a password. Longer keys such as `Enter` and `Tab` pass, so a replay can still submit.
    - `Match` reports `resource` when it renders a state. The `id` is the resource's `inspect()` node id: `resource(fetcher)` has no ctx and no id of its own, and E1204 routes every rendered resource through `Match`.
    - `Boundary` reports `error` when it catches, and the router reports `error` when a loader or action returns `err`.
  - **Current route.** A new observer first receives the ctx's current `nav`, if one exists. A recorder started after mount therefore knows its route.
  - **Isolation.** Observers run synchronously, in registration order. A throw in one is dropped, and the others still run, so observing never changes app behavior.
  - **Seed.** `seedOf` is a function, so `Ctx` gains no field (RFC 0066 rejected `ctx.std` for the same reason).
  - **Clauses.** "Under a sim ctx, a navigation, a `fire`, a resource state and a `Boundary` catch each reach `observe` once, in order; a password `input` value arrives as `x` repeated; an observer added after a navigation gets it first, one that throws stops no other, and none gets an event after its stop function runs." and "`seedOf(ctx)` is the seed given to `createCtx`, and 0 when none was given."
- **Reactive registry and payload schemas (k.store).**

  ```ts
  // @keel/store
  export function stores(): ReadonlyMap<string, Store<unknown>>;   // unchanged signature; an effect reading it reruns on join or leave
  interface Store<T> { readonly payloads: ReadonlyMap<string, Schema<unknown>> }   // transaction name -> its `schema`
  ```

  Exposing the `Transaction` objects was rejected, since any reader could then `tx` them. Clauses: "An effect reading `stores()` reruns when a store is created and when its scope is disposed." and "`payloads` maps each transaction declared on a store to that transaction's `schema` and holds no other name."
- **Harness navigation and caller (k.testing).**

  ```ts
  // @keel/testing
  renderRoute(id, { routes, params, search?, state?, ctx?, caller?: string }): Promise<RouteHandle>;   // caller default ""
  interface RouteHandle { navigate(href: Href): Promise<void> /* plus the render handle */ }
  ```

  `navigate` resolves when the new route is rendered and its loaders have settled, the same quiescence `fire` waits for. `replay` and emitted tests use it, and conformance scripts can navigate without an `<a>` click. `caller` is what the route's guards receive (k.router). Clause: "`navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled."
- **Guards receive the caller (k.router, D2).**

  ```ts
  // @keel/router
  export function guard(decl: { readonly redirect: string },
    fn: (req: { readonly url: string; readonly caller: string }, ctx: Ctx) => Promise<Result<null, KeelError<"keel.denied", unknown>>>): Guard;
  ```

  - **Value.** `caller` is the hashed caller id k.server computes for loaders: the base64url SHA-256 of a signed caller cookie's token, else `""`. A GET mints no cookie, so an anonymous GET is `""`.
  - **Where.** `createApp` passes it to `runGuard`. A client-only app's router passes `""`, or its `caller` option. The route harness passes `renderRoute`'s `caller`.
  - **Compatibility.** A guard written `async ({ url }, ctx)` still compiles: the parameter only gains a field.
  - **Clause.** "A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`)."
- **The `session` command slot (k.cli).**

  ```ts
  // @keel/cli
  export type Outcome = { readonly records: readonly OutRecord[]; readonly writes: readonly Write[] };
  export type StdOperation = Operation & { readonly run: (input: Input, io: Io) => Promise<Outcome> };
  export function stdCommand(name: string, op: StdOperation): void;   // only "session"; another name or another op: E1053
  // Io.fetch?: (url: string, init?: RequestInit) => Promise<Response>        (init: headers, so ingest can send a cookie)
  // Input gains failing?: boolean; since?: string; "max-runs"?: number      (CommandName gains "session")
  ```

  - **Engine.** `runEngine` answers `session` in three steps:
    1. It runs `importDeps` over the project's manifests, which loads `@keel/std-sessions/tools`.
    2. If the slot is filled, it parses argv with the slot's input schema and runs it.
    3. Otherwise it reports I1055, as it does today.
  - **Refill.** Filling the slot again with the same operation is a no-op; another operation throws E1053, extended to "formatter kind or std command registered twice".
  - **Surfaces.** The operation is served on all three surfaces, so `keel mcp` lists a `session` tool only in a project that depends on std-sessions. This is a closed slot whose names k.cli lists, not a seventh extension point: a stdlib package cannot add a command name.
  - **Clause.** "After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053."
- **`./tools` loading and client-readable keys (k.module).**

  ```ts
  // @keel/compiler/std/importDeps: signature unchanged
  export function importDeps(root: string, files: readonly SourceFile[]): Promise<Diagnostic[]>;
  // @keel/compiler/std/clientStd: `keys` is new (D2)
  export function clientStd(pkg: string, keys?: readonly string[]): void;
  ```

  - **`./tools`.** `importDeps` imports each `@keel/std-*` package as today, then its `./tools` export when the package's `exports` map has one. A throw there is E1159 at the entry, as for the root. `keel check`, `keel build` and `keel session` therefore see the rules and the command, while a browser bundle of `@keel/std-sessions/record` holds no tooling.
  - **`keys`.** With `keys`, `clientStdData` keeps only those top-level keys of each module's config for `pkg`. std-sessions calls `clientStd("@keel/std-sessions", ["redact"])`, so `readers` and `expose` never reach `#k-state` or a `client` bundle.
  - **Clauses.** "With `clientStd(pkg, ['a'])`, `#k-state` holds only key `a` of each module's `pkg` config." and "`keel check` imports a `deps` package's `./tools` export: a rule it registers reports, and a throw is E1159."
- **Project files for rules (k.check, coordinator addition 2026-11-09).**

  ```ts
  // @keel/check
  export type RuleInput = { readonly file: SourceFile; readonly ast: Program; readonly artifacts: Readonly<Record<string, unknown>>;
    readonly project: readonly SourceFile[] };   // the project's code files and its topology.ts; one shared, read-only array
  ```

  E2005 needs the `topology.ts` that places a module, and E2001 needs the `transaction(...)` and `store(...)` calls of sibling files. Rules still report only on `file`. Clause: "A rule receives, as read-only `project`, every code file of its file's project and that project's `topology.ts`, the same array for each file it checks."

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
- **Server (D5).** With no global `document` (a server render, a node test), `record` is a no-op: it registers no observer and no effect, `events()` and `errors()` stay `[]`, it never calls `put`, and `stop()` returns a session with `route.id` `''`, empty `params`, `search` and `state`, no events, and the no-error fingerprint. Browsers and happy-dom tests record. A per-request server recorder would hold every request's payloads in one process, and the request ctx is shared by `createApp`.
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
  - **Default (D3).** Recording is on by default: `record` keeps every value except `redact` entries, `s.secret` fields and password input (masked by the observer). Modules do not declare what they record. Stricter output is the job of `to-test` (§8), which is what leaves the machine through the Action.
  - **Config.** `record` reads `stdConfig(ctx, "@keel/std-sessions", SessionsConfig)` and merges every module's `redact` list. A test binds config the rfc:0069 way, with `bindStd(ctx, { "@keel/std-sessions": { cart: { redact: [...] } } })` before `record`. No new option is added.
  - **Entry grammar.** An entry is `<subject>:<target>#<path>`. The path is dot-separated and `*` matches one array index.
  - **Subjects.** `tx:<transaction name>#<payload path>` uses the schema from `store.payloads`. `store:<store id>#<state path>` uses `store.schema`, and applies to `state` and to snapshots in the base. `route:<route id>#params.<k>|search.<k>` uses the schemas carried by the `nav` event; the recorder rewrites the `href` from the event's path pattern and sorted search. `el:<element id>#value` applies to `fire` input values. `error:<code>#data.<path>`: error codes have no registered data schema.
  - **Replacement values.** A schema-backed value becomes `gen` of the field's schema, seeded by `fnv(seed, entry, path)`, so the payload still parses. An `el:` or `error:` string becomes `x` repeated to its length, a number becomes 0, a boolean `false`, anything else `null`.
  - **Secrets.** An `s.secret` field is always replaced with a generated inner value. Encoding gives the `"[secret]"` marker, which fails `parse` (k.schema), so the payload would not parse otherwise. Password inputs are already masked by the observer.
  - **Copies.** Redaction applies to `events()`, `stop()` and uploads. `errors()` and the fingerprint use the unredacted error.
- **Overflow (gap 2).**
  - **Cut.** When an append makes `events` longer than `limit`, the buffer drops every event up to and including the oldest buffered `nav`, and rebases `route`, `at` and `state` to that navigation. The state is the snapshot `record` took when that `nav` was observed: it keeps one snapshot per buffered `nav`.
  - **No `nav` buffered.** The buffer drops every event before the appended one, keeps the appended one if it is an input (`fire` or `nav`) and drops it otherwise, and rebases to the current route and state. A `fire` is reported before its handlers run, so the rebased state does not yet hold its effect; dropping it would make the replay end in a different `state()` from the live app.
  - **Bound.** After any cut a session holds at most `limit` events.
- **Upload.** With `upload`, the first `error` event makes `record` call `session(ctx).put(upload, <session so far>)` once. Recording continues.
- **Live section.** `record.ts` registers inspector hook `sessions.live` (schema: `Session` or `null`). Its `read(ctx)` returns the active recorder's session so far, without stopping it. `keel session capture` reads it.

### 5. Session shape and fingerprint (gap 3)
```ts
type Session = { v: 1; id: Id<"Session">; seed?: number; deterministic: boolean; at: number; route: { id: string; params: JsonObject; search: JsonObject };
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
   - Inputs are applied. A `fire` calls the harness `fire(id, event)`. A `nav` carries `href` as a plain string (the `sessions.Session` schema cannot parse JSON into a branded `Href` without a cast). `replay` matches its path and search with `@keel/router/internal` (`compileRoutes`, `compileTable`, `matchUrl`), then calls `routes.href(id, params, search)` on the widened table and `navigate` with the result: a typed `Href`, no cast (rule 6).
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
- **Operation.** `session` takes the input `{ op: "capture" | "ingest" | "replay" | "minimize" | "to-test", target?: string, failing?: boolean, since?: string, "max-runs"?: number }` plus the common flags. Its positional fields are `["op", "target"]`. Its file scope is the project: manifests, `topology.ts`, each module's `routes.ts`, `.keel/*.json`, and the target file.
- **`capture [url]`.** It fetches the inspect document (default `http://localhost:5173`, E1056 rules as `keel inspect`), takes `sections["sessions.live"].value`, and writes `.keel/sessions/<fingerprint>-<id>.json`. A `null` value writes nothing and emits only the summary, exit 0: a dev app that is not recording is not an error, and no new code is needed.
- **`ingest <url> [--failing] [--since t]`.** It sends `GET <url>/sessions/list?failing=1&since=<t>` with `accept: application/json`. When `KEEL_SESSIONS_TOKEN` is set, its value goes in the caller cookie (`__Host-keel-caller` for https, else `keel-caller`, k.server). The command reads `results["sessions.list"]` as `ok(Archive)` and writes each session as `.keel/sessions/<fingerprint>-<id>.json`. A caller the `sessions.reader` guard denies is redirected to `sessions.ingest` (§9), so the followed response has no `sessions.list` result. That response, or a non-2xx one, is E1056, as for `inspect`.
- **`replay <f>`, `minimize <f>`, `to-test <f>`.**
  - **Parse.** Each parses `<f>` with `sessions.Session` (failure: E2002).
  - **Deployable.** Each finds the deployable serving `route.id`: the `topology.ts` deployable whose modules include the route id's module prefix. With none, the result is E2003 naming the base.
  - **Run.** Each runs inside the project's `keel test` runner, with the same vitest start, `KEEL_TEST=1` and the project's `vitest.config` environment, against that deployable's route table: the union of its modules' `routes` (`manifest({ ...a.routes, ...b.routes })`, as the client entry builds it). App code runs only where `keel test` already runs it.
  - **Job file.** The mechanism is backlog 0094's to choose. The candidate is a job test file that `@keel/std-sessions/tools` writes under `.keel/sessions/` with the session path and the routes files, read back through a result file, and removed afterward.
  - **`replay`.** It emits one `session` record and the diagnostics below.
  - **`minimize`.** It rewrites `<f>` (one write through `io.apply`) and emits a `session` record with `file: <f>`.
  - **`to-test`.** It writes `modules/<m>/test/session-<fingerprint>.test.ts`, where `<m>` is `route.id` up to its first `.`, and emits a `session` record with `file` set to that path.
  - **`to-test` redaction (D3).** Before it writes, `to-test` rewrites the session. Every value whose schema is `s.string()` becomes `x` repeated to its length, unless an `expose` entry of the route's module names its path. This covers base `state` (`store:`), base and `nav` `params` and `search` (`route:`), `fire` `input` values and one-character `keydown` keys (`el:<id>#value`), and error `data` strings (`error:`). `s.id`, `s.literal` and `s.enum` values are not `s.string()` and stay, since they carry no free text. `s.secret` fields and password values are already redacted at record time. It then replays the rewritten session, and if the fingerprint differs it reports E2004 and writes nothing. Length is kept so that empty stays empty and length checks still fail the same way. The Action's issue body holds only the `session` record (codes, counts, ids) and this emitted test, so it carries no unexposed string.
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
- **`listSessions` (reader access, D2).**
  - **Output.** `loader({ output: Archive, search: ListSearch }, fn)` returns the archive filtered by `failing` (error not null) and `since` (`last >= since`).
  - **Guard.** `sessions.list` declares `guard: reader`, the `sessions.reader` guard: `src/reader.guard.ts` exports `reader = guard({ redirect: "sessions.ingest" }, ...)`, and `routes.ts` imports the value, so the manifest stays literal. It returns `ok(null)` when `caller` is in the merged `readers` lists of `stdConfig(ctx, "@keel/std-sessions", SessionsConfig)`, else `err(keel.denied)`. An absent or empty list denies everyone, and so does `caller` `""`. Denial redirects (302) to `sessions.ingest` with `next`, as every guard does. No loader runs.
  - **Tokens.** An operator gets a token by making one write to the ingest service, then takes the minted caller cookie as the Action's `token` and adds its hash to `readers`. The hash is `caller`, the base64url SHA-256 of the cookie token (k.server).
  - **Exposure.** `readers` is server-only config: `clientStd("@keel/std-sessions", ["redact"])` keeps it out of `#k-state` and `client` bundles. It holds hashes of server-signed tokens, and a hash cannot be turned back into a cookie.
- **E2005.** A deployable whose adapter is not `node` and one of whose modules' `routes.ts` imports `@keel/std-sessions/routes` is E2005, at that import. Recording (`record`) in a `client` deployable is clean: the conformance fixture had treated any std-sessions dependency as E2005, which contradicts browser recording.

### 10. Check rules E2001, E2005 (`@keel/std-sessions/tools`)
- **E2001** reads each app `module.ts` `std['@keel/std-sessions'].redact` and `.expose` literal. It reports at the string literal, with a fix that deletes that array element (and its comma). Three cases are reported:
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
| 2 overflow, navigate | no `nav` buffered: drop all before the appended event, keep it if an input, rebase now; base holds route and state; harness `navigate(href)` (k.testing) |
| 3 replay result | `state` added; `reproduced` is fingerprint equality, so error-free reproduces error-free; `unapplied` |
| 4 minimize, to-test | inputs are `fire` and `nav`; `minimize` rewrites `<f>`; library `minimize`; buggy fixture project `cart-bug` and fix overlay; `run(["test"], …)` on a disk copy |
| 5 ingest | `@keel/std-sessions/routes`; guard `sessions.reader` checks `caller` (k.router) against server-only `readers`; `Archive` shape |
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
- **Run replay in-process through Vite's SSR loader (rejected, D1).** `keel render` has the same gap ("needs a compiled component or route loader"). A second app-code loader would run app code under a different transform and environment than `keel test`, so a session could reproduce in one and not the other.
- **Put `sessions.list` behind an app guard, as the spec had it.** Route manifests must be literal (E1005), so a package route cannot take an app guard. An app-owned list route would leave the package without a tested list endpoint.
- **Check readers in the loader, with `readers` in client-readable config (the draft).** Guards could not see `caller`, so the draft denied in the loader and let the reader hashes reach island documents. D2 moves the check to a guard that sees `caller` and keeps `readers` on the server.
- **`s.string({ public: true })` as the D3 marker.** k.schema has no annotations; the option would touch `gen`, `doc`, `encode` and JSON Schema export for one consumer. `expose` reuses the `redact` grammar and E2001.
- **Readers outside std config (`ctx.storage` key, env).** It needs a second way to configure a stdlib package. `clientStd` `keys` is one optional parameter on the existing opt-in.
- **Record on the server, per request ctx.** `createApp` shares one ctx across requests, so a recorder there would mix requests and hold their payloads in process memory (D5).
- **A synthetic `nav` event at an overflow with no navigation.** Replay would apply it as an input and re-run loaders the live app never ran at that moment.
- **Count N from 1.** `unapplied`, array indices and the conformance property all count from 0.
- **FNV-1a for the fingerprint.** It is smaller and synchronous, but the spec named sha256 and the cost is 0.8 kB once.

## Spec diff
Measured as `ceil(chars / 4)`, the rule `tooling/budgets.mjs` and `pnpm spec` use. New kernel clauses are appended to each Conformance list: the ledger keys clauses by number (`k.router#10`), and an insertion renumbers the clauses after it, which `keel ledger --diff` reports as lowered rungs (E1706). Every section ends at or under 1,500. Trims are non-normative words only: citations, examples, cross-references and restatements. No rule changed.

### std.sessions (1,498 -> 1,489 file, 1,498 printed)
The section is replaced by the text below. Against the draft:
- the Output paragraph moved to docs/OUTPUT.md;
- the Artifacts paragraph became one Action sentence, without the issue title (§11 keeps it);
- the manifest literal became a sentence;
- the second redact example and the algorithm detail of `minimize` (§7 keeps it) are dropped.
- "`at` is `ctx.clock.now()`" (clause 1 states it) and "E2001, E2005: check" (§10 keeps it) are dropped.

````md
# std.sessions: Sessions
status: implemented

**Module.** `@keel/std-sessions` is stdlib module `sessions` (capabilities `clock`, `observe`, `session`, `storage`; exports, routes below). Modules set `std['@keel/std-sessions']: { redact?, expose?, readers? }` (string arrays; tests: `bindStd`); only `redact` reaches browsers.
A `redact` or `expose` entry is `<subject>:<target>#<path>`: `tx:` transaction name (payload), `store:` id (state), `route:` id (`params.*`, `search.*`), `el:` element id (its values in every event), `error:` code (`data.*`). `record` keeps every value but `redact` entries, which become their schema's generated value (`el:`, `error:` strings: `x` repeated). `s.secret` values (also in `nav` search) and password inputs are always redacted; error messages drop every redacted value. `to-test` also writes each `s.string()` value no `expose` entry names as `x` repeated.

**API.** Capability `session(ctx)`: `put(url, s): Promise<Result<null, KeelError>>` (real: POST, non-2xx `sessions.putFailed`; sim: kept in `taken(): { url, session }[]`) and `id()`: `random.id('Session')` on its own ctx. `record(ctx, { limit = 500, upload?: URL })` returns `{ events(), errors(), stop(): Session }`, one per ctx (again: the same); with `upload` it puts the session on the first `error`. Without `document` it is a no-op.
```ts
type SessionEvent = { at: number } & ({ kind: 'tx'; store; name; payload: JsonValue } | { kind: 'nav'; href: string }
  | { kind: 'resource'; id; state: 'loading' | 'ready' | 'error' } | { kind: 'fire'; id; event: TestEvent } | { kind: 'error'; error: KeelError })
type Session = { v: 1; id: Id<'Session'>; seed?: number; deterministic: boolean; at: number; route: { id; params; search }; state: { [storeId]: JsonValue }; events: SessionEvent[]; error: KeelError | null; fingerprint: string }
```
The base (`at`, `route`, `state`) is the ctx's route when `record` starts, else its first `nav`. `seed` is `seedOf(ctx)`, absent (and `deterministic` false) when unseeded. `Session` is `sessions.Session`. `fingerprint`: 12 hex of sha256(`code`, `data.at`, route id then) of `error` (the first), before redaction (none: `''`, `''`, `route.id`). Past `limit` events the buffer drops through its oldest `nav` and rebases there (none: drops all but the new event if an input or error, rebases now).

`replay(session, { routes })` renders the base under a sim ctx of `seed` (absent: 0) at `at`, then per event advances the clock to its `at` and applies inputs (`fire`, `nav`); others are observations. Returns `{ observed, state, error, reproduced, unapplied }`: final `state()`; `reproduced` iff fingerprints match (unseeded: state may differ); `unapplied` the 0-based index of the input it stopped at, else `null`. `minimize(session, { routes, maxRuns = 200 })`: delta debugging over inputs until removing any one loses the fingerprint (at `maxRuns`: smallest found).

**Commands** (k.cli `session`). `capture [url]` saves inspect section `sessions.live` · `ingest <url> [--failing] [--since t]` fetches `sessions.list` (cookie `KEEL_SESSIONS_TOKEN`) to `.keel/sessions/<fingerprint>-<id>.json` · `replay <f>` · `minimize <f> [--max-runs n]` rewrites `<f>` · `to-test <f>` writes `modules/<route module>/test/session-<fingerprint>.test.ts`: header `// Session: <fingerprint>, seed <n>`, ending `expect(rec.errors()).toEqual([])`. The last three run under `keel test` on the deployable serving `route.id`. The Action `@keel/std-sessions/action` runs them nightly, with one `keel-session` issue per reproduced fingerprint; it never pushes.

**Ingest.** `routes`: `sessions.ingest` (`POST /sessions`, input `Session`, over 256 KiB 413) re-fingerprints and adds it to store `sessions.archive` (per fingerprint `count`, `first`, `last`, newest 5; at most 64, oldest `last` evicted); `sessions.list` (`/sessions/list`, search `{ failing?, since? }`) loads it behind guard `sessions.reader`: `caller` in config `readers`, else redirect to `sessions.ingest`.

**Rules.** E2001 `redact` or `expose` entry with an unknown subject, a subject of another module, or a path absent from its schema (fix removes it) · E2002 session file fails `sessions.Session` · E2003 replay cannot apply input N or the base · E2004 replay fingerprint differs (`minimize`, `to-test` stop) · E2005 a non-`node` deployable serves `routes`. E2002-E2004: `keel session` diags at the file, 1:1.

**Conformance.**
- Under one sim seed, one script of fires produces byte-equal sessions; events are in occurrence order with `at` equal to `ctx.clock.now()` then.
- A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema.
- After overflow, a session holds at most `limit` events and its replay ends in the same `state()` as the live app.
- Replaying an unmodified session reproduces every store's final state and its fingerprint.
- `minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal.
- The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied.
- A `to-test` file holds no recorded `s.string()` value outside `expose`, and no `s.secret` or password value.
- A valid POST to `sessions.ingest` is listed by `sessions.list` under its fingerprint; invalid input is 422 `keel.fields`; a sixth session of one fingerprint keeps 5 and counts 6; a caller not in `readers` is redirected to `sessions.ingest`.
- The `session` capability has all three implementations; shell `put` returns `ok(null)` and sends nothing.
- Without a global `document`, `record` records no event through transactions and errors and never calls `put`.
- E2001 fires on a fixture, not on its clean twin.
- E2002 fires on a fixture, not on its clean twin.
- E2003 fires on a fixture, not on its clean twin.
- E2004 fires on a fixture, not on its clean twin.
- E2005 fires on a fixture, not on its clean twin.
````

Clause changes against the current section:
- Clause 3 drops "starts at a navigation". The base is a navigation's route, but with no `nav` buffered the rebase is to the current route, and the clause now says what holds in both cases.
- Clause 7 is new (D3): the `to-test` redaction.
- Clause 8 (ingest) appends the reader case (D2).
- Clause 10 is new (D5): the server no-op.
- The amendment's body changes (unseeded sessions, `el:` scope, secret search, error messages, overflow keeping the error) touch no clause text; clause 2 already requires that no redacted value appear in the session JSON. To fit them, the Action sentence lost its step list (§11 keeps it), and "`el:`" and "`error:`" seeding detail, "invariant `sessions.capped`", "shell: drop" (clause 9 states it), "(names it)" in E2003 and "straight-line" moved to the RFC only.
- The body follows the implementation (agent S): `nav.href` is `string` (replay re-derives the `Href`), and an overflow with no `nav` buffered keeps the appended event when it is an input. No clause text changed for these.
- "Each of E2001-E2005 has a fixture that triggers it and a clean counterpart." becomes five clauses, one per code, so each of the five rule files cites one clause it asserts in full (RFC 0049).

### k.ctx (1,152 -> 1,491 file, 1,497 printed)
- **Observers.** A paragraph is inserted before **Rules.**:
  > **Observers.** `observe(ctx, fn): () => void` calls `fn` synchronously with each event the kernel reports on `ctx`, in order, until the returned function runs; a throw in `fn` is dropped. Events (`CtxEvent`): `{ kind: 'nav', href, route: { id, path, params, search, schemas } }` when the router starts a navigation, before guards (a new observer first gets the current one); `{ kind: 'fire', id, event }` when runtime-dom dispatches a `FireEvent` (k.testing `TestEvent`) to element `id`, before its handlers (on a field ever `type="password"` or `autocomplete` `current-password`/`new-password`, for the rest of the ctx, an `input` value and a one-character `keydown` key are `x` repeated); `{ kind: 'resource', id, state }` when `Match` renders a resource state (`id`: its `inspect()` node id); `{ kind: 'error', error }` when a `Boundary` catches or a loader or action returns `err`. `seedOf(ctx)` is the seed `createCtx` was given, `undefined` when none.
- **Conformance** appends:
  - "Under a sim ctx, a navigation, a `fire`, a resource state and a `Boundary` catch each reach `observe` once, in order; a password field's `input` value arrives as `x` repeated, also after its `type` changes; an observer added after a navigation gets it first, one that throws stops no other, and none gets an event after its stop function runs."
  - "`seedOf(ctx)` is the seed given to `createCtx`, and `undefined` when none was given."
- **Map.** The k.ctx row gains `observers`.
- **Trims (amendment).** The citations "(rfc:0043)" and "(rfc:0053, 0058, 0061, 0065)" are dropped; the ADR index holds them.

### k.store (1,361 -> 1,442)
- "`stores()` returns the live stores by id." becomes "`stores()` returns the live stores by id; an effect reading it reruns when one joins or leaves (rfc:0070)."
- "A store exposes readonly `schema` and `id`;" becomes "A store exposes readonly `schema`, `id` and `payloads` (each transaction's payload schema by name);"
- Conformance appends:
  - "An effect reading `stores()` reruns when a store is created and when its scope is disposed."
  - "`payloads` maps each transaction declared on a store to that transaction's `schema` and holds no other name."

### k.testing (1,448 -> 1,498)
- "`renderRoute(id, { routes, params, search?, state?, ctx? })` (`routes`: the manifest) runs the route's guards and loaders," becomes "`renderRoute(id, { routes, params, search?, state?, ctx?, caller? })` runs the route's guards (given `caller`, default `''`) and loaders,".
- "`renderRoute` handles have it too." becomes "`renderRoute` handles have it too, and `navigate(href)`, resolving when the new page is ready."
- Conformance appends: "`navigate(routes.href(id))` on a `renderRoute` handle runs the target's guards and loaders and resolves with its chain rendered and every loader settled."
- Trims: "Pass `ctx` to control clock, seed, and net fixtures.", "(`routes`: the manifest)", "(docs/TESTING.md)" after the rung sentence, and `state: [], ` in the `renderRoute` example.

### k.router (1,498 -> 1,500)
- The guard example becomes `export const auth = guard({ redirect: 'app.login' }, async ({ url, caller }, ctx) => ok(null))`.
- After "Routes hold the value (`guard: auth`).": "`caller` is k.server's `caller` (`''` if none or client-only)."
- Conformance appends: "A guard's `caller` is the hash `createApp` gives loaders (`''` with no signed cookie) and under `renderRoute` its `caller` option (default `''`)."
- Trims, non-normative:
  - "**Manifest.** Each module's `routes.ts` exports one manifest; a deployable's route table is their union." becomes "**Manifest.** One per module, in `routes.ts`; a deployable's route table is their union."
  - The example drops the `orders.shell` layout entry and `layout: 'orders.shell'`, and the `// modules/app/auth.guard.ts` comment.
  - The example comment "// manifest, action, loader, guard: @keel/router" and Form's "from `@keel/router`" become one Execution sentence: "API: `@keel/router`; `@keel/router/internal` is not public." It replaces "Server internals: `@keel/router/internal`, not public."
  - "(`mount`)" after "client-only app" is dropped.
  - "A redirect revisiting a location, or a ninth, is E1508." in Guards is dropped: the E1508 clause states it word for word.

### k.cli (1,492 -> 1,499)
- "`session` is reserved for the stdlib sessions module; without it the kernel reports I1055 (info, exit 0)." becomes "`session` runs the operation std.sessions registers with `stdCommand('session', op)` (`@keel/cli`) after importing the project's std `deps`; unfilled, I1055 (info, exit 0)."
- Rules: "E1053 formatter kind registered twice" becomes "E1053 formatter kind or std command registered twice".
- Conformance appends: "After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053."
- Trims, non-normative: "(k.testing)" in the `test` and `ledger` rows, "(k.server)" in the `build` row, "(info, exit 0)" after the `session` sentence's I1055 (Rules states it), "Same input, same diagnostics on every surface." (conformance clause 1 states it); "(principle 6)"; "(k.server)" in the `dev` row; "(k.reactive)" and "(k.store)" in Inspect; "The viewer is the Keel app `apps/inspector`." and "The viewer renders each from `doc` and `value`." (the inspector app's README says so); ", RFC 0042"; ": one data model, three renderings"; "e.g. `scaffold` without `@keel/scaffold`" in I1055.

### k.module (1,499 -> 1,500)
- "import each `@keel/std-*` package in an app module's `deps` once," becomes "import each `@keel/std-*` package in an app module's `deps` once, and its `./tools` export, if any,".
- "packages marked with `clientStd(pkg)` (`@keel/compiler/std/clientStd`)" becomes "packages marked `clientStd(pkg, keys?)` (`@keel/compiler/std/clientStd`; `keys`: only those top-level keys)".
- Conformance appends:
  - "With `clientStd(pkg, ['a'])`, `#k-state` holds only key `a` of each module's `pkg` config."
  - "`keel check` imports a `deps` package's `./tools` export: a rule it registers reports, and a throw is E1159."
- Trims, non-normative: ", so its rules and config schema register" (k.check step 3 states it), "(rfc:0066)", "(rfc:0069)", "(`importDeps`, `@keel/compiler/std/importDeps`)", ", k.compiler", ", k.schema", "(k.server)", ", principle 3", "(`@keel/std-*`)" in the `std` bullet (E1158 keeps it), "; topology and shells read this list", and "Each module has its own `routes.ts`; a deployable's route table is the union of its modules' manifests." (k.router states it).

### k.check (1,278 -> 1,340)
- Pipeline step 3 ends "... (`.keel/*.json`, manifests) and `project`: the project's code files and its `topology.ts`, one shared array (rfc:0070)."
- The registry example's `check` destructures `{ file, ast, artifacts, project }`.
- Conformance appends: "A rule receives, as read-only `project`, every code file of its file's project and that project's `topology.ts`, the same array for each file it checks."

### spec/00-map.md
The k.ctx row gains `observers`. std.sessions becomes `implemented` in the map and in its header: clauses 5-8 and 12-14 stay skipped until 0093 and 0094, so it is not `conformance-covered`.

### docs/OUTPUT.md (not a spec section)
- The JSON paragraph's list of record kinds gains `session`.
- One line is added after it: "`session` (std.sessions): `{ kind, id, fingerprint, route, events, inputs, error, file }`; compact `7f3a9c01d2e4 orders.show 42 events orders.locked`, `ok` for no error, ` -> <file>` when one was written."

### docs/THREAT-MODEL.md
A "Stdlib commitments" list with one **Sessions** bullet:
- `record` is on by default in a browser and keeps payloads, state and input values, except `redact` entries, `s.secret` fields and password inputs (the observer masks password values and one-character keys). On the server it is a no-op.
- Uploads are same-origin JSON POSTs under the k.server write proof. `sessions.ingest` takes unauthenticated posts (256 KiB, 5 per fingerprint, 64 fingerprints) and recomputes fingerprints.
- `sessions.list` is behind the `sessions.reader` guard (a `caller` hash in `readers`). `readers` and `expose` are server-only; only `redact` reaches browsers.
- `to-test`, and through it the Action's issue bodies, writes every unexposed `s.string()` value as `x` repeated. Session files keep what `record` kept, so the emitted test is the form to share.

## Conformance diff
Seed 1337 throughout. "0092", "0093" and "0094" name the task that unskips a file.

### Clause-to-file map (D4)
Each clause is cited, verbatim, by exactly one file that asserts all of it (RFC 0049). The 0091 suite had 13 files for 9 clauses, with the five rule files sharing one clause. It now has 15 files for 15 clauses.

| # | std.sessions clause (short) | file | change | unskipped by |
| --- | --- | --- | --- | --- |
| 1 | byte-equal sessions, occurrence order | `deterministic-sessions.test.ts` | none | 0092 |
| 2 | redacted value absent, payload parses | `redaction.test.ts` | edited | 0092 |
| 3 | overflow: at most `limit`, same `state()` | `overflow-rebase.test.ts` | header quotes the new clause | 0092 |
| 4 | replay reproduces state and fingerprint | `replay-reproduces.test.ts` | gap comment removed | 0092 |
| 5 | `minimize` reproduces, 1-minimal, equal runs | `minimize.test.ts` | edited | 0094 |
| 6 | `to-test` passes check, fails, passes with fix | `to-test.test.ts` | edited | 0094 |
| 7 | `to-test` holds no unexposed string, secret or password | `to-test-redaction.test.ts` | new, split from `to-test.test.ts` | 0094 |
| 8 | ingest, list, 422, cap, reader redirect | `ingest-list.test.ts` | header quotes the new clause | 0093 |
| 9 | capability: three implementations, shell `put` | `capability.test.ts` | none | 0092 |
| 10 | no `document`: no events, no `put` | `record-server-noop.test.ts` | new | 0092 |
| 11 | E2001 fires, clean twin does not | `E2001-redact-path.test.ts` | header quotes "E2001 fires on a fixture, not on its clean twin." | 0092 |
| 12 | E2002 | `E2002-session-file-schema.test.ts` | header, per code | 0094 |
| 13 | E2003 | `E2003-replay-input.test.ts` | header, per code | 0094 |
| 14 | E2004 | `E2004-not-reproduced.test.ts` | header, per code | 0094 |
| 15 | E2005 | `E2005-adapter-not-node.test.ts` | header, per code | 0092 |

| section | clause (short) | file | by |
| --- | --- | --- | --- |
| k.ctx | `observe`: one event per occurrence, masking, replay of current nav, isolation, stop | `packages/testing/conformance/ctx-observe.test.ts` (needs router and runtime-dom) | 0092 |
| k.ctx | `seedOf` | `packages/ctx/conformance/seed-of.test.ts` | 0092 |
| k.store | reactive `stores()` | `packages/store/conformance/stores-reactive.test.ts` | 0092 |
| k.store | `payloads` | `packages/store/conformance/store-payloads.test.ts` | 0092 |
| k.testing | harness `navigate` | `packages/testing/conformance/route-navigate.test.ts` | 0092 |
| k.router | guard `caller` under `createApp` and `renderRoute` | `packages/server/conformance/guard-caller.test.ts` | 0092 |
| k.cli | `stdCommand` slot | `packages/cli/conformance/std-command.test.ts` | 0092 |
| k.module | `clientStd` keys | `packages/server/conformance/client-std-keys.test.ts` | 0092 |
| k.module | `./tools` import | `packages/cli/conformance/std-tools-import.test.ts` | 0092 |
| k.check | `RuleInput.project` | `packages/check/conformance/rule-project.test.ts` | 0092 |

The kernel sections stay `conformance-covered`, so `keel ledger --diff` reports E1707 for each new kernel clause until its file lands. The ten kernel files belong in the commit that adds these spec lines.

### Edited (rfc:0070), `packages/std-sessions/conformance/`
- **`fixtures.ts`.**
  - Transaction names become `"cart.add"` and `"cart.pay"`, since the `tx:` subject is the logged transaction name (E1155 convention).
  - `play(seed, script, { limit?, redact? })` calls `bindStd(ctx, { "@keel/std-sessions": { cart: { redact } } })` before `record`.
  - `Step` gains `{ nav: true }`, played as `h.navigate(cartRoutes().href("cart.show"))`, and `stepArb` includes it.
  - New `buggyRoutes()`: a second route table whose component adds a `cart.checkout` button built with `@keel/ui` (`Button` with `onClick`), so its handler runs through the delegated table and a `Boundary` catches. The handler reads `card.number.length` from a payload built only when the card is non-empty, so it throws `keel.unexpected` at `cart.checkout` exactly when the cart has items and the card is empty.
  - New `buggySession()`: records the script `add, card "x", card "", nav, add, checkout` on `buggyRoutes()`. It has 6 inputs, and its 1-minimal sets have 2 (`add, checkout`).
  - The gap comment is removed. `cartModuleFiles` names the transaction `'cart.pay'`.
  - The store is built inside `scope()` and seeded `{ items: [], card: "" }` per `renderRoute`, so each play starts from the same state. The page is built from `@keel/ui` `Box`, `Button`, `Input` and `Link`.
  - `buggyRoutes()` and `buggySession()` land with 0094, the first task that uses them.
- **`redaction.test.ts`.** It passes `redact: ["tx:cart.pay#card.number", "el:cart.card#value"]` to `play`: the `fire` input event carries the same card number, so a `tx:` entry alone cannot keep it out of the session JSON. It filters `e.name === "cart.pay"`. The gap comment goes. Unskipped by 0092.
- **`overflow-rebase.test.ts`.** The header quotes the new clause 3. The first test asserts `session.events.length <= limit`, replacing `limit + 1` and the first-event `nav` check. The gap comment goes. Unskipped by 0092.
- **`replay-reproduces.test.ts`.** Only the gap comment is removed. The assertions already match `state` and `reproduced`. Unskipped by 0092.
- **`deterministic-sessions.test.ts`.** Unchanged. Unskipped by 0092.
- **`capability.test.ts`.** Its `sample()` session gains `at: 0`, since `Session.at` is new. Unskipped by 0092.
- **`E2001-redact-path.test.ts`.** It imports `@keel/std-sessions/tools` in place of the package root. Unskipped by 0092.
- **Rule files.** Each of the five `E200x-*.test.ts` headers quotes its own per-code clause in place of the shared one; bodies are unchanged by this.
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
- **`ingest-list.test.ts`.** The `test.todo` lines become tests against `createApp({ routes, ctx: sim, ... })`, with config bound by `bindStd`. The caller is taken from the cookie the first POST mints. The reader case binds `readers: [<that hash>]` and checks that another caller's `GET /sessions/list` is a 302 to `/sessions` with `next`, with no archive in the body. The header quotes the new clause 8. Unskipped by 0093.

### Added
- `packages/std-sessions/conformance/to-test-redaction.test.ts` (clause 7, split from `to-test.test.ts`). On a disk copy of `fixtures/cart-bug/` whose `module.ts` sets `expose: ['store:cart.cart#note']`, it records a session whose store state, route search, `fire` input values and error data hold distinct marker strings, one of them in the exposed `note`, plus an `s.secret` field and a password input. It runs `to-test` and asserts the emitted file contains the exposed marker and none of the others, no secret inner value and no password value. Unskipped by 0094.
- `packages/std-sessions/conformance/record-server-noop.test.ts` (clause 10, `// @vitest-environment node`). Under a sim ctx with `upload`, it commits transactions and makes a `createApp` loader return `err`; `events()` stays `[]`, `errors()` stays `[]`, and `session(ctx).taken()` stays `[]`. Unskipped by 0092.
- `packages/std-sessions/conformance/fixtures/cart-bug/`: `topology.ts` (`web`, `client`), `vitest.config.ts` (happy-dom), `modules/cart/{module.ts, cart.ts, routes.ts, CartPage.ts}`, the same logic as `buggyRoutes()` as files, and `modules/cart/module.ts` with `deps: ['@keel/std-sessions']`.
- `packages/std-sessions/conformance/fixtures/cart-bug.fix/modules/cart/CartPage.ts`: the fix. The handler guards the empty card and renders a `cart.cardMissing` message.
- `packages/testing/conformance/ctx-observe.test.ts` (k.ctx clause; in `@keel/testing` because it needs router and runtime-dom): a property over scripts of `fire`, `navigate` and resource fixtures that checks one event per occurrence, in order, the current-route replay, and silence after stop. Done by 0092.
- `packages/store/conformance/stores-reactive.test.ts` and `store-payloads.test.ts` (k.store clauses). Done by 0092.
- `packages/ctx/conformance/seed-of.test.ts`, `packages/server/conformance/guard-caller.test.ts`, `packages/cli/conformance/std-command.test.ts`, `packages/server/conformance/client-std-keys.test.ts`, `packages/cli/conformance/std-tools-import.test.ts`, `packages/check/conformance/rule-project.test.ts` (the map above). Done by 0092.
- `packages/testing/conformance/route-navigate.test.ts` (k.testing clause). Done by 0092.

### Not conformance (unit tests in 0092)
- `packages/std-sessions/test/`: upload (one `taken()` entry on the first error, none for later errors), redaction of each subject, `stop()` idempotence, one recorder per ctx, the `sessions.live` section, fingerprint vectors, the `session` formatter through `respond` (`@keel/cli/testing`), and `config-registered.test.ts` extended for `expose`, `readers` and the `redact`-only client keys.

## Migration
- **Kernel callers.** No existing call changes. `observe`, `seedOf`, `payloads`, `navigate`, `stdCommand`, `clientStd` `keys`, `RuleInput.project` and the guard's `caller` field are additions; a guard that destructures only `{ url }` compiles unchanged, and so does a rule that ignores `project`. `stores()` becoming reactive changes only effects that read it, and none exist outside tests. `TestEvent` stays exported from `@keel/testing` as an alias.
- **`@keel/cli` `Io.fetch`.** The new `init` parameter is optional, so existing callers and tests are unchanged.
- **0092 (this RFC's implementation).**
  - Kernel: `observe`, `seedOf`, `report`, and the reports in router, runtime-dom (`fire` with password masking of `input` values and one-character keys, `Match`, `Boundary`) and router loaders and actions; reactive `stores()` and `payloads`; harness `navigate` and `renderRoute` `caller`; guard `caller` in the router, server and harness; `stdCommand`; `importDeps` `./tools`; `clientStd` `keys`; `RuleInput.project`.
  - Package: the capability, `record` (no-op without `document`) and redaction, `SessionsConfig` with `redact`, `expose`, `readers` and `clientStd(pkg, ['redact'])`, `Session`, `replay`, the `sessions.live` section, the `session` formatter, E2001, E2005, and the `tools.ts` and package exports.
  - Conformance: unskip as listed above.
- **0093 (ingest service).** It implements `@keel/std-sessions/routes` (`ingestSession`, `listSessions`, `Archive`, store `sessions.archive`, `addSession`, `sessions.capped`) and Keel's own node deployable that serves `routes.routes` behind the app origin. It adds the `sessions.reader` guard (`src/reader.guard.ts`), sets `readers` in its module's `std` and unskips `ingest-list.test.ts`. It needs nothing else from 0092 than the `Session` schema, `SessionsConfig.readers` and guard `caller`.
- **0094 (`keel session`).** It implements the `session` operation in `tools.ts`: `capture`, `ingest` (cookie, `Io.fetch` init), `replay`, `minimize` (library and command), `to-test` with its `expose` redaction, the run-under-`keel test` job, and E2002-E2004. It also adds the `cart-bug` fixtures and unskips the E2002-E2004, `minimize`, `to-test` and `to-test-redaction` files.
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
  - A budget raised for any of these is recorded in tasks/0092-std-sessions/PLAN.md with the measured bytes.
- **Output budgets.** `mcp.tools-list` (1,500 tokens) is measured at the repository root. No `module.ts` there lists std-sessions, so the slot stays empty and the tool list is unchanged. In an app with std-sessions, the `session` tool adds about 150 tokens.

## Token impact
Measured with `keel spec <id>`'s printed output, section text plus its summary line, which is what the k.cli clause "`keel spec k.cli` prints <= 1,500 tokens" and the k.check budget count (the file alone is about 6 tokens less): std.sessions 1,498; k.ctx 1,497; k.store 1,449; k.testing 1,493; k.router 1,493; k.cli 1,493; k.module 1,497; k.check 1,347; spec map 893 (file). Before this RFC the files measured std.sessions 1,498, k.ctx 1,152, k.store 1,361, k.testing 1,448, k.router 1,498, k.cli 1,492, k.module 1,499 and k.check 1,278. Every section prints at or under 1,500. std.sessions, k.module, k.testing, k.router and k.cli are within 7 tokens of the limit, so the next clause in any of them needs a trim or a split.

## Known limits
- **Browser base.** A browser recording's base is a loaded route, so replay re-runs that route's loaders on the loaded state, and a loader that appends instead of replacing doubles its entries.
- **Random ids after a rebase.** After a rebase, ids the app draws with `ctx.random` differ between live and replay: the stream position at the cut is not recorded. Fingerprints still match, since they carry no ids.
- **Same-origin uploads.** `upload` must be same-origin: `createApp` serves no CORS preflight.
- **Redacted inputs replay as replacements.** An `el:` input replays as `x` repeated and a `route:` parameter as its generated value. A bug that depends on the real value does not reproduce.
- **Store ids in emitted tests.** `to-test` imports stores by the `<module>.<name>` id convention. A store whose id breaks it (E1155 off) is left out of the emitted `state`, and the test starts that store from its initial value.
- **Ingest concurrency.** The ingest archive is read, changed and written per request, so two concurrent posts can lose one. Fine at nightly-triage volume, and a store with `ctx.storage` compare-and-set would close it.
- **Static checks.** E2001 does not report paths in schemas it cannot resolve statically (imported from another module, built by a function).
- **`to-test` redaction can lose the bug.** A bug that depends on the content of an unexposed string, not its length, does not reproduce from the rewritten session. `to-test` then reports E2004 and writes nothing, and the fix is an `expose` entry for that path.
- **Keys on password fields.** One-character `keydown` keys on a password field replay as `x`. A handler that reacts to a specific printable key there does not reproduce.
