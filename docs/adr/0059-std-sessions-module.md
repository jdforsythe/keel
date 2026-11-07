# ADR-0059: @keel/std-sessions on kernel observers; `keel session` runs under the test runner (RFC 0070)

**Status:** proposed

**Context.**
- std.sessions (backlog 0092) records sessions in browsers, replays them under sim, and turns failures into tests. Backlog 0091's conformance suite found 7 points the section left open: the redact list under sim, overflow without a `nav`, the replay result, `minimize`/`to-test` outputs and fixtures, ingest access and shape, the E2002-E2004 record shape, and `taken()`.
- The kernel had no push channel for `fire`, `resource`, `error` or `nav` events: inspector hooks are pulled. It also had no seed accessor and no payload schemas on a store, and its `stores()` was not reactive.
- k.cli reserved `session` but had no way for a stdlib package to fill it.

**Decision.**
- **Observers (k.ctx).** `observe(ctx, fn)` receives `nav` (router, with the route's schemas), `fire` (runtime-dom delegated listener; password values masked), `resource` (`Match`, inspect node id) and `error` (`Boundary`, loader or action `err`), synchronously and in order. A new observer first gets the current `nav`. `seedOf(ctx)` returns the ctx seed. `Ctx` gains no field.
- **k.store.** `stores()` is reactive, and a store exposes `payloads`, its payload schemas by name.
- **k.testing.** A route handle gains `navigate(href)`.
- **k.cli.** `stdCommand('session', op)` fills the reserved name after `importDeps`. Unfilled is I1055. Refilling is E1053.
- **k.module.** `importDeps` also imports a package's `./tools` export. std-sessions keeps rules, formatter and command in `./tools`, so browsers never load `@keel/check`.
- **Capability.** `session(ctx)` is `{ put, taken, id }`. `id()` draws from the capability's own ctx, so recording never moves the app's random stream.
- **`record`.**
  - **Base.** The base (`at`, `route`, `state`) is the current route at start, else the first `nav`.
  - **Sources.** `tx` comes from reactive `log()` reads, flushed before each observed event; everything else comes from `observe`.
  - **Config.** Redaction config comes through `stdConfig`, and tests use `bindStd`.
  - **Overflow.** An overflow drops through the oldest `nav` and rebases there. With no `nav`, it drops everything and rebases at the current route and state.
  - **Limits.** One recorder per ctx; inert without `document`.
- **Fingerprint.** sha256 of `code`, `data.at` and the error's route, computed before redaction. An error-free session's fingerprint has an empty code and `at`.
- **`replay`.** It returns `{ observed, state, error, reproduced, unapplied }`. `reproduced` is fingerprint equality. `unapplied` is the 0-based index of the input it stopped at.
- **`minimize`.** It is public, deterministic delta debugging over `fire` and `nav` inputs, and the command rewrites `<f>`.
- **`keel session replay|minimize|to-test`** run inside the project's `keel test` runner, on the route table of the deployable serving `route.id`. E2002-E2004 are `diag` records at the session file, 1:1. The emitted test imports `record`, stores by id, and routes, and navigates with `routes.href(...)`.
- **Ingest.** `@keel/std-sessions/routes` (literal) serves `sessions.ingest` (re-fingerprinted; at most 256 KiB, 5 per fingerprint, 64 fingerprints) and `sessions.list`. The list loader admits `caller` hashes listed in config `readers`; guards cannot see callers. E2005 fires on a non-`node` deployable importing `routes`, while recording in a `client` deployable is clean.

**Alternatives.**
- Inspector-hook taps: these are pull-only and would lose events between pulls.
- A global event bus: it mixes parallel tests and requests.
- A store commit listener: it would be a second way beside `log()`.
- Exposing `Transaction` objects: holders could `tx` them.
- A `ctx.seed` field.
- Minting ids with `ctx.random`: it moves the app's stream.
- A `node` export condition for the tooling half: node servers would load `typescript`.
- An in-process Vite SSR loader for replay: app code would run under a second environment.
- An app-defined guard on a package route: the manifest must be literal, and guards see only the URL.
- A synthetic `nav` at overflow: replay would re-run loaders the live app never ran.

**Consequences.**
- Spec tokens: std.sessions 1,498 -> 1,495; k.ctx 1,152 -> 1,406; k.store 1,361 -> 1,412; k.testing 1,448 -> 1,490; k.cli 1,492 -> 1,495 (the `apps/inspector` sentence and two citations cut); k.module 1,499 -> 1,499 (citations cut).
- Conformance (rfc:0070):
  - 9 std-sessions files edited, mostly fixture names and gap comments.
  - E2003 and `minimize` move their properties to the library.
  - `to-test`, E2004 and one CLI case each run on a disk fixture `conformance/fixtures/cart-bug/` with a fix overlay.
  - 3 new kernel conformance files: `testing/ctx-observe`, `store/stores-reactive`, `testing/route-navigate`.
- Budgets: a new `"@keel/std-sessions": "6kb"` entry. Kernel growth is estimated at 0.05-0.4 kB per package, measured in 0092. `@keel/compiler` may need a D7 raise.
- THREAT-MODEL gains a Sessions bullet. Recording is allowlist-redacted, uploads are same-origin, ingest is capped and unauthenticated, reader hashes reach island documents, and emitted tests and issue bodies carry recorded values.
- **Known limits.**
  - A browser base replays its route's loaders again, so a loader that appends doubles its entries.
  - Random ids diverge after a rebase.
  - There are no cross-origin uploads.
  - Redacted inputs replay as their replacements.
  - Concurrent ingest posts can lose one.
  - E2001 stays silent on schemas it cannot resolve statically.
- **Open (for the user).**
  - The test-runner execution route.
  - Caller-hash readers in client-visible config.
  - Default-on recording and issue bodies in public repositories.
  - The kernel surface split.
  - Inert server-side `record`.
