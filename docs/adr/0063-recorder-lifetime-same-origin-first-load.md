# ADR-0063: the recorder outlives its component, uploads are same-origin, first-load errors reach a late recorder (RFC 0074)

**Status:** accepted (2026-11-09). Parts 1 and 2 under the WORKFLOW RFC defaults 1, 2 and 6; part 3 as option (c) under defaults 3 and 4, with no new app-facing API. The served loader error on an island page is a proposed follow-up.

**Context.** The recorder's reactive scope belonged to the component that called `record`; disposing that component stopped recording silently and turned a failed upload into an unhandled rejection. The k.server write proof refuses cross-site uploads, and nothing said so. An error reported before any component could call `record` was lost, because `observe` replays only the current `nav`.

**Decision.**
- **Detached scope (k.reactive).** `scope(fn, { detached: true })` is a root: no `parent`, no outer disposal or `onError`, `fn` untracked with writes still checked; only its own `dispose()` ends it. It extends `scope` instead of adding `root`.
- **Recorder (std.sessions).** The recorder's scope is detached and `stop()` disposes it; a `record` after `stop()` starts a fresh recorder. A non-2xx, rejected or throwing put is `sessions.putFailed` (status 0 without a response), recorded, never thrown.
- **Same-origin uploads (std.sessions, E2006).** The recording app mounts `@keel/std-sessions/routes` in its own `node` deployable and uploads to its own origin. `record` throws E2006 (`code`, `see`, one-line message) when `upload.origin` is not `location.origin` or the page's origin is opaque. Without `document` it checks nothing. No check rule: the page's origin is not in the source.
- **Kept errors (k.ctx).** The ctx keeps the first 16 `error` events since its current `nav`, observed or not; a `nav` clears them. Every new observer gets the current `nav`, then the kept errors, then live events. `Boundary` reports every catch.

**Alternatives.**
- `root(fn)`, rejected as a second way to make a scope.
- A ctx lifetime for the scope, rejected: a ctx has no disposal.
- Documentation only for same-origin, rejected by default 6.
- A forwarder route, rejected as a second upload path.
- (a) config-driven start in the generated entries and (b) a module `start` hook, rejected as new hand-written shapes when (c) needs none.
- Keeping every event kind until the first observer, rejected: `fire` and `resource` are hot paths.

**Consequences.**
- k.reactive gains the `detached` option and two conformance clauses; k.ctx one sentence and one clause; std.sessions E2006, one sentence and one clause, with trims listed in RFC 0074.
- apps/sessions keeps `record` in `Home` and records an error reported between the served route and its resume.
- Kept errors are stamped when a late recorder starts. A second recorder after `stop()` may upload the same errors again.
- A server-side loader error on an island page is still not recorded; RFC 0074 proposes carrying it in `#k-state` for `resume` to report.
