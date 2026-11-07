# std.sessions: Sessions
status: proposed

**Module.** `@keel/std-sessions` ships a stdlib manifest (k.module) `{ id: 'sessions', capabilities: ['clock', 'random', 'storage'], public: { exports: ['record', 'replay', 'session', 'Session'], routes: ['sessions.ingest', 'sessions.list'] } }`. Apps opt in with `deps: ['@keel/std-sessions']`; each app module lists its own redactions (`stdConfig`, k.module; `clientStd`, as `record` redacts in browsers):
```ts
std: { '@keel/std-sessions': { redact: ['tx:cart.pay#card.number', 'route:orders.show#search.q'] } }
```
Subjects: `tx:` name (payload), `store:` id (state), `route:` id (`params.*`, `search.*`), `el:` element id (`value`), `error:` code (`data.*`). A redacted value becomes its field schema's generated value (seeded by session seed and path), so the session still parses; `el:` values become `x` repeated. Password `input` values are always redacted.

**API.** `register('session', { real, shell, sim })` (k.ctx) returns the accessor `session`, the sink: `session(ctx).put(url, s): Promise<Result<null, KeelError>>` (real: POST; shell: drop; sim: keeps them in `taken()`). `record(ctx, { limit = 500, upload?: URL })` returns `{ events(), errors(), stop(): Session }`; with `upload` it puts the session on the first `error` event.
```ts
type SessionEvent = { at: number } & (
  | { kind: 'tx'; store: string; name: string; payload: JsonValue }
  | { kind: 'nav'; href: Href }
  | { kind: 'resource'; id: string; state: 'loading' | 'ready' | 'error' }
  | { kind: 'fire'; id: string; event: TestEvent }   // k.testing union
  | { kind: 'error'; error: KeelError })             // Boundary catch, loader/action err
type Session = { v: 1; id: Id<'Session'>; seed: number; route: { id; params; search }; state: { [storeId]: JsonValue }; events: SessionEvent[]; error: KeelError | null; fingerprint: string }
```
`at` is `ctx.clock.now()`; `id` is `ctx.random.id('Session')`; `Session` is `s.register('sessions.Session', ...)` (schema type registry). `tx`, `nav` come from `stores()`/`log()`, `route()`; `resource`, `fire`, `error` from inspector hooks (rfc 0063). `fingerprint`: 12 hex of sha256(`error.code`, `error.data.at`, `route.id`). On overflow the ring buffer cuts at the next `nav` and rebases `route` and `state` there.

`replay(session, { routes })` runs `renderRoute(route.id, { routes, params, search, state, ctx })` under `createCtx({ mode: 'sim', seed })`, then per event advances the sim clock to `at` and applies inputs (`fire`, `nav` via `navigate`); `tx`, `resource`, `error` are observations. Returns `{ observed, error, reproduced }`.

**Commands** (k.cli `session`; I1055 without the module). `capture [url]` saves a dev app's live session (inspect document `sessions` section) · `ingest <url> [--failing] [--since t]` downloads stored sessions to `.keel/sessions/<fingerprint>-<id>.json` · `replay <f>` · `minimize <f> [--max-runs 200]`: delta debugging over input events (shortest reproducing prefix, then subsets) until removing any one input loses reproduction · `to-test <f>` writes `modules/<route module>/test/session-<fingerprint>.test.ts`: header `// Session: <fingerprint>, seed <n>`, straight-line `renderRoute`, `fire`, `navigate`, clock `advance` under that seed, ending `expect(rec.errors()).toEqual([])`.

**Ingest.** In a `node` deployable, route `sessions.ingest` (`/sessions`) has a `POST` action (input `Session`, max 256 KiB, else `sessions.tooLarge`) that applies `tx(addSession)` to store `sessions.archive` (per fingerprint: count, first and last `at`, newest 5; invariant `sessions.capped`) and persists it via `ctx.storage`; route `sessions.list` (`/sessions/list`, search `{ failing?, since? }`) loads it behind guard `sessions.reader`, which the app defines (E1506 otherwise).

**Output.** Formatter registry kind `session`: `{ kind, id, fingerprint, route, events, inputs, error, file }`; compact `7f3a9c01d2e4 orders.show 42 events orders.locked`.

**Artifacts.** Session files (`sessions.Session`), emitted tests, GitHub Action `@keel/std-sessions/action` (composite; inputs `url`, `token`): nightly, `ingest --failing`, then per fingerprint `replay`; reproduced: `minimize`, `to-test`, open or update one `keel-session` issue per fingerprint (title `session <fingerprint>: <code> at <route>`, body the `session` record and test); else one comment. It never pushes.

**Rules.** E2001 `redact` path with an unknown subject, a subject of another module, or a field absent from its schema (check rule registry; fix removes it) · E2002 session file fails `sessions.Session` · E2003 replay cannot apply input event N (id absent from `ids.json`, href matches no route; message names N) · E2004 replay did not reproduce the session's fingerprint (`minimize`, `to-test` stop) · E2005 `sessions` in a deployable whose adapter is not `node` (check rule). E2002-E2004 come from `keel session`.

**Conformance.**
- Under one sim seed, one script of fires produces byte-equal sessions; events are in occurrence order with `at` equal to `ctx.clock.now()` then.
- A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema.
- After overflow, the session starts at a navigation and its replay ends in the same `state()` as the live app.
- Replaying an unmodified session reproduces every store's final state and its fingerprint.
- `minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal.
- The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied.
- A valid POST to `sessions.ingest` is listed by `sessions.list` under its fingerprint; invalid input is 422 `keel.fields`; a sixth session of one fingerprint keeps 5 and counts 6.
- The `session` capability has all three implementations; shell `put` returns `ok(null)` and sends nothing.
- Each of E2001-E2005 has a fixture that triggers it and a clean counterpart.
