# std.sessions: Sessions
status: implemented

**Module.** `@keel/std-sessions` is stdlib module `sessions` (capabilities `clock`, `session`, `storage`; exports and routes as below). Modules set `std['@keel/std-sessions']: { redact?, expose?, readers? }` (string arrays; tests: `bindStd`); only `redact` reaches browsers.
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
