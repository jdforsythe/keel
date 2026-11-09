# @keel/std-sessions

**Spec:** std.sessions · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** stdlib module `sessions` (`module.ts` at the package root; capabilities `clock`, `session`, `storage`). Subpaths `./record`, `./replay`, `./session`, `./Session`, `./redact`, `./tools`; the root re-exports them for tests and node.
  - `record(ctx, { limit = 500, upload? })` returns `{ events(), errors(), stop() }`, one per ctx. The base is the ctx's route when it starts, else its first `nav`. `tx` comes from each store's `log()`; `nav`, `fire`, `resource` and `error` come from `observe` (k.ctx). Past `limit` the buffer drops through its oldest `nav` and rebases there; with none buffered it rebases to now and keeps the appended input. With `upload`, the first error puts the session through `session(ctx)`. Without `document` it is a no-op. It registers inspect section `sessions.live`.
  - Redaction: each module's `redact` entries (`<subject>:<target>#<path>`, subjects `tx`, `store`, `route`, `el`, `error`) become their schema's generated value, seeded by the session seed and path. `el:` and `error:` values become `x` repeated. An `el:` entry masks every input value and one-character key of its element, and so does an element once reported masked (a password). `s.secret` fields always go, and `nav` hrefs are rebuilt from the redacted params and search. Every value an entry matched is masked again in later error messages and data; other free text in errors is out of scope. `redact(schema, value, { paths, seed, salt, strings?, found? })` is the pure function.
  - `seed` is absent for a real or shell ctx (unseeded random), and `deterministic` is then false: a replay runs under seed 0 and may draw other ids.
  - Overflow with no `nav` buffered rebases to the newest input but the oldest, at the state it saw; else to now, keeping the appended input or error, so an upload always names its error.
  - `redactSession(session, { routes, expose })` writes every recorded string outside `expose`, and every error message, as `x` repeated (what `to-test` emits, D3).
  - `replay(session, { routes })` returns `{ observed, state, error, reproduced, unapplied }` under `createCtx({ mode: 'sim', seed })`.
  - `session(ctx)`: `put(url, session)` (real POST, shell drop, sim kept in `taken()`) and `id()` from the capability's own ctx.
  - `Session` (`sessions.Session`), `SessionEvent`, `SessionsConfig` (`{ redact?, expose?, readers? }`; only `redact` reaches browsers).
  - `./tools` (node): check rules E2001 (`redact` or `expose` entry with an unknown subject, another module's target, or a path absent from its schema; fix removes it) and E2005 (a non-`node` deployable serves `@keel/std-sessions/routes`), and the `session` record formatter.
- **Not yet:** `minimize`, the `routes` ingest service and the `keel session` command (backlogs 0093, 0094).
- **Dependencies:** `@keel/check`, `@keel/cli` (tools only), `@keel/compiler`, `@keel/ctx`, `@keel/reactive`, `@keel/router`, `@keel/schema`, `@keel/store`, `@keel/testing`, `oxc-parser` (tools only).
- **Rungs:** conformance (examples and properties, seed 1337) for determinism, redaction, overflow, replay, the capability, the server no-op, E2001 and E2005; properties for `sha256`, `redact` and `redactSession`.

## Extension points

Uses **capabilities** (`session`), **inspector hooks** (`sessions.live`), the **rule registry** (E2001, E2005), the **formatter registry** (record kind `session`) and **std config** (`clientStd` with `keys`).

## Unsafe

count: 0
