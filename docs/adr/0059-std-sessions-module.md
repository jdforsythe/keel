# ADR-0059: @keel/std-sessions on kernel observers; `keel session` runs under the test runner (RFC 0070)

**Status:** accepted (user, 2026-11-09)

**Context.**
- std.sessions (backlog 0092) records sessions in browsers, replays them under sim, and turns failures into tests. Backlog 0091's conformance suite found 7 points the section left open: the redact list under sim, overflow without a `nav`, the replay result, `minimize`/`to-test` outputs and fixtures, ingest access and shape, the E2002-E2004 record shape, and `taken()`.
- The kernel had no push channel for `fire`, `resource`, `error` or `nav` events: inspector hooks are pulled. It also had no seed accessor and no payload schemas on a store, and its `stores()` was not reactive.
- k.cli reserved `session` but had no way for a stdlib package to fill it. Guards could not see the caller, and `clientStd` sent a package's whole config to browsers.
- The user answered the draft's five questions on 2026-11-09 (tasks/0092-std-sessions/PLAN.md D1-D5).

**Decision.**
- **Kernel additions, one RFC (D4).** Final signatures are in RFC 0070 §2; each has one conformance clause in its section.
  - **k.ctx.** `observe(ctx, fn)` receives `CtxEvent`s: `nav` (router, with the route's schemas), `fire` (runtime-dom delegated listener; on a password field, `input` values and one-character keys are `x` repeated), `resource` (`Match`, inspect node id) and `error` (`Boundary`, loader or action `err`), synchronously and in order. A new observer first gets the current `nav`. `seedOf(ctx)` returns the ctx seed. `Ctx` gains no field.
  - **k.store.** `stores()` is reactive, and a store exposes `payloads`, its payload schemas by name.
  - **k.testing.** A route handle gains `navigate(href)`, and `renderRoute` takes `caller`.
  - **k.router (D2).** A guard's `fn` gets `{ url, caller }`: the hashed caller id k.server gives loaders, `""` when anonymous; the harness passes `renderRoute`'s `caller`.
  - **k.cli.** `stdCommand('session', op)` fills the reserved name after `importDeps`. Unfilled is I1055. Refilling with another operation is E1053.
  - **k.module.** `importDeps` also imports a package's `./tools` export, so rules, formatter and command stay out of browser bundles. `clientStd(pkg, keys?)` limits client-readable config to the listed top-level keys.
  - **k.check.** `RuleInput.project` gives each rule the project's code files and `topology.ts`, read-only and shared (coordinator addition, for E2001 and E2005).
- **Capability.** `session(ctx)` is `{ put, taken, id }`. `id()` draws from the capability's own ctx, so recording never moves the app's random stream.
- **`record`.**
  - **Default (D3).** Recording is on by default. It keeps every value except `redact` entries, `s.secret` fields and password input.
  - **Base.** The base (`at`, `route`, `state`) is the current route at start, else the first `nav`.
  - **Sources.** `tx` comes from reactive `log()` reads, flushed before each observed event; everything else comes from `observe`.
  - **Config.** `SessionsConfig` is `{ redact?, expose?, readers? }`. Only `redact` is client-readable (`clientStd(pkg, ['redact'])`); tests use `bindStd`.
  - **Overflow.** An overflow drops through the oldest `nav` and rebases there. With no `nav`, it drops every earlier event, keeps the appended one if it is an input, and rebases at the current route and state.
  - **Server (D5).** Without a `document`, `record` is a no-op: no events, no upload. One recorder per ctx.
- **Fingerprint.** sha256 of `code`, `data.at` and the error's route, computed before redaction. An error-free session's fingerprint has an empty code and `at`.
- **`replay`.** It returns `{ observed, state, error, reproduced, unapplied }`. `reproduced` is fingerprint equality. `unapplied` is the 0-based index of the input it stopped at. A recorded `nav.href` is a string; replay re-derives the typed `Href` through the router's matcher and `routes.href`.
- **`minimize`.** It is public, deterministic delta debugging over `fire` and `nav` inputs, and the command rewrites `<f>`.
- **`keel session replay|minimize|to-test` (D1)** run inside the project's `keel test` runner, on the route table of the deployable serving `route.id`. E2002-E2004 are `diag` records at the session file, 1:1.
- **`to-test` redaction (D3).** It writes every `s.string()` value as `x` repeated, keeping its length, unless config `expose` names the path. It replays the rewritten session first and stops on E2004. The marker is `expose`, not a schema annotation: k.schema has none, and an option on `s.string` would reach `gen`, `doc`, `encode` and JSON Schema export for one consumer.
- **Ingest.** `@keel/std-sessions/routes` (literal) serves `sessions.ingest` (re-fingerprinted; at most 256 KiB, 5 per fingerprint, 64 fingerprints) and `sessions.list`. `sessions.list` is behind the `sessions.reader` guard, which admits a `caller` listed in server-only `readers` and otherwise redirects to `sessions.ingest`. E2005 fires on a non-`node` deployable importing `routes`, while recording in a `client` deployable is clean.

**Amendment (2026-11-09, red-team 0206-0210, 0213).** `seedOf` returns `undefined` for an unseeded ctx, and such a session has no `seed` and `deterministic: false`; its replay runs under seed 0, and `reproduced` covers the fingerprint only. A field that was ever a password field (`type` or `autocomplete`) stays masked for the rest of the ctx. An `el:` entry redacts that element's values in every event kind. `s.secret` search values are redacted in `nav` hrefs, error messages drop every redacted value, and an overflow keeps the error that triggered it.

**Alternatives.**
- Inspector-hook taps: these are pull-only and would lose events between pulls.
- A global event bus: it mixes parallel tests and requests.
- A store commit listener: it would be a second way beside `log()`.
- Exposing `Transaction` objects: holders could `tx` them.
- A `ctx.seed` field.
- Minting ids with `ctx.random`: it moves the app's stream.
- A `node` export condition for the tooling half: node servers would load `typescript`.
- An in-process Vite SSR loader for replay (D1): app code would run under a second environment.
- Reader check in the loader with `readers` in client-readable config (the draft): reader hashes reached island documents (D2).
- An app-defined guard on a package route: the manifest must be literal.
- `s.string({ public: true })` as the exposure marker (D3).
- Recording on the server per request (D5): `createApp` shares one ctx, so a recorder would mix requests.
- A synthetic `nav` at overflow: replay would re-run loaders the live app never ran.

**Consequences.**
- Spec tokens, as `keel spec <id>` prints them: std.sessions 1,498; k.ctx 1,497; k.store 1,449; k.testing 1,493; k.router 1,493; k.cli 1,493; k.module 1,497; k.check 1,347. The near-full sections were trimmed of citations, examples and restatements only.
- Conformance (rfc:0070):
  - std.sessions has 15 clauses, each cited by one file: the five rule files get per-code clauses, and `to-test-redaction.test.ts` and `record-server-noop.test.ts` are new.
  - E2003 and `minimize` move their properties to the library.
  - `to-test`, its redaction, E2004 and one CLI case each run on a disk fixture `conformance/fixtures/cart-bug/` with a fix overlay.
  - 10 new kernel conformance files, one per new kernel clause. Until each lands, `keel ledger --diff` reports E1707 for its clause.
- Budgets: a new `"@keel/std-sessions": "6kb"` entry. Kernel growth is estimated at 0.05-0.4 kB per package, measured in 0092. `@keel/compiler` may need a raise.
- THREAT-MODEL gains a Sessions bullet. Recording is on by default with allowlist redaction, server recording is a no-op, uploads are same-origin, ingest is capped and unauthenticated, `readers` and `expose` stay on the server, and `to-test` output carries only exposed strings.
- **Known limits.**
  - A browser base replays its route's loaders again, so a loader that appends doubles its entries.
  - Random ids diverge after a rebase.
  - There are no cross-origin uploads.
  - Redacted inputs replay as their replacements, and a bug that depends on an unexposed string's content stops `to-test` with E2004 until that path is exposed.
  - Concurrent ingest posts can lose one.
  - E2001 stays silent on schemas it cannot resolve statically.
