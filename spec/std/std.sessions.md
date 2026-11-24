# std.sessions: Sessions
status: implemented

**Module.** `@keel/std-sessions` is stdlib module `sessions` (capabilities `clock`, `observe`, `session`, `storage`). Modules set `std['@keel/std-sessions']: { redact?, expose?, readers? }`; browsers get only `redact`.
An entry is `<subject>:<target>#<path>`: `tx:` transaction (payload), `store:` id (state), `route:` id (`params.*`, `search.*`), `el:` element (its values in every event), `error:` code (`data.*`). `record` keeps every value but `redact` entries and `.pii()` values, which become their schema's generated value (`el:`, `error:`: `x` repeated). `s.secret` values (also in `nav` search) and password inputs are always redacted; error messages and `data` (not `data.at`) drop redacted values. `to-test` writes each `s.string()` no `expose` entry names as `x` repeated.

**API.** Capability `session(ctx)`: `put(url, s): Promise<Result<null, KeelError>>` (real: POST, non-2xx `sessions.putFailed`; sim: in `taken(): { url, session }[]`) and `id()`: `random.id('Session')` on its ctx. `record(ctx, { limit = 500, upload?: URL })` returns `{ events(), errors(), stop(): Session }`, one per ctx until `stop()`; `upload` puts it on the first `error`.
```ts
type SessionEvent = { at: number } & ({ kind: 'tx'; store; name; payload } | { kind: 'nav'; href }
  | { kind: 'resource'; id; state: 'loading' | 'ready' | 'error' } | { kind: 'fire'; id; event: TestEvent } | { kind: 'error'; route; error: KeelError } | { kind: 'net'; online })
type Session = { v: 1; id: Id<'Session'>; seed?; deterministic; at; route: { id; params; search }; state: { [store]: JsonValue }; events: SessionEvent[]; error: KeelError | null; fingerprint }
```
`id` matches `^[A-Za-z0-9_-]{1,64}$` (a `random.id` UUID does) wherever a `Session` parses, nested ones included: a session file failing it is E2002, a `sessions.ingest` body 422. The base (`at`, `route`, `state`) is the ctx's route at `record`, else its first `nav`. `seed` is `seedOf(ctx)`, absent (`deterministic` false) when unseeded. `fingerprint`: 12 hex of sha256(`code`, `data.at`, route id) of the first `error` as recorded (none: `''`, `''`, `route.id`). Past `limit` the buffer drops through its oldest `nav`, rebasing there (none: keeps a new input or error, rebases now).

`replay(session, { routes, redact? })` (`./replay`; the root imports no harness) renders the base (missing stores: `initial`) under a sim ctx of `seed` (absent: 0) at `at`, with the recording's `redact`, then per event advances the clock to `at` and applies inputs (`fire`, `nav`, `net`: `setOnline`), skipping one the previous input already produced (a click's `submit`, an action's `nav`); others are observations. An input it cannot apply is E2003, so the fingerprint differs. Returns `{ observed, state, error, reproduced, unapplied }`: final `state()`; `reproduced` iff fingerprints match; `unapplied` the input index it stopped at, else `null`. `minimize(session, { routes, maxRuns = 200, redact? })`: ddmin over inputs (at `maxRuns`: smallest found).

**Commands** (k.cli `session`). `capture [url]` (default `http://localhost:5173`) saves `sessions.live` to `.keel/sessions/<fingerprint>-0.json`; a section that is absent, `null` (no `record` on the page), an `error` or not a `Session` is E1056 (k.cli), exit 1, nothing written · `ingest <url> [--failing] [--since t]` fetches `sessions.list` (cookie `KEEL_SESSIONS_TOKEN`) to `.keel/sessions/<fingerprint>-<n>.json` (unreachable, non-2xx or no `sessions.list` result: E1056) · `replay <f>` · `minimize <f> [--max-runs n]` rewrites it · `to-test <f>` writes `modules/<route module>/test/session-<fingerprint>.test.ts`: header `// Session: <fingerprint>, seed <n>`. The last three run under `keel test` on the deployable serving `route.id` with its modules' `redact`. The Action `@keel/std-sessions/action` runs them nightly: a `keel-session` issue per reproduced fingerprint, never a push.

**Ingest.** `./contract` (std.contracts): `sessions.ingest` (`POST /sessions`, `Session`, over 256 KiB 413) recomputes `error` and `fingerprint` from `events`, adds it to store `sessions.archive` (per fingerprint `count`, `first`, `last`, newest 5; at most 64 fingerprints and 4 MiB, oldest `last` out, not the one written). `sessions.list` (`/sessions/list`, query `{ failing?, since? }`) loads it behind guard `sessions.reader`: `user` or `caller` in `readers`, else 403.

**Rules.** E2001 `redact`/`expose` entry whose subject is unknown or another module's, or whose path its schema lacks (fix removes it) · E2002 session file fails `sessions.Session` · E2003 replay cannot apply input N or the base · E2004 replay fingerprint differs (`minimize`, `to-test` stop) · E2005 a non-`node` deployable serves `routes` · E2006 a `record` `upload` not credential-free http(s) on the page's origin. E2002-E2004 diag the file at 1:1.

**Conformance.**
- Under one sim seed, one script of fires produces byte-equal sessions; events are in occurrence order with `at` equal to `ctx.clock.now()` then.
- A redacted payload value never appears in the session JSON, and the redacted payload parses with its transaction's schema.
- After overflow, a session holds at most `limit` events and its replay ends in the same `state()` as the live app.
- Replaying an unmodified session reproduces every store's final state and its fingerprint.
- `minimize` output reproduces the fingerprint; removing any one of its input events does not; two runs are equal.
- The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied.
- A `to-test` file holds no recorded `s.string()` value outside `expose`, and no `s.secret` or password value.
- A valid POST to `sessions.ingest` is listed under its fingerprint; invalid input is 422 `keel.fields`; a sixth of one fingerprint keeps 5, counts 6; a caller not in `readers` gets 403 `keel.denied`.
- The `session` capability has all three implementations; shell `put` returns `ok(null)` and sends nothing.
- Without a global `document`, `record` records no event through transactions and errors and never calls `put`.
- E2001-E2005 each fire on a fixture, not on its clean twin.
- `record` throws E2006 on a cross-origin `upload`, not on a same-origin one.
- A POST naming another session's `fingerprint` is filed under its own recomputed one; 20 flood POSTs totalling less than 4 MiB leave an earlier real session in place.
- `keel session capture <url>` against an inspect document whose `sessions.live` section is absent, is `{ doc, value: null }`, is `{ doc, error }`, or holds a value that fails `sessions.Session` emits one E1056, writes no file and exits 1; with a section holding a valid `Session` it writes `.keel/sessions/<fingerprint>-0.json` and exits 0.
- `sessions.Session` refuses a session whose `id` is `''`, `../x`, `a b` or 65 `a`s, its first issue's `path` being `['id']`, and accepts `id`s `a`, `A-z_9` and 64 `a`s; `keel session replay` of a session file whose `id` is `../x` emits E2002 and exits 1; a POST of that session to `sessions.ingest` is 422 `keel.fields`.
