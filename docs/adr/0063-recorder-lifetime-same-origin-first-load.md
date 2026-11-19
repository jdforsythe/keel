# ADR-0063: the recorder outlives its component, uploads are same-origin, first-load errors reach a late recorder (RFC 0074)

**Status:** accepted (2026-11-09), amended the same day after the review and red-team passes (backlog 0264-0269, 0271). Parts 1 and 2 under the WORKFLOW RFC defaults 1, 2 and 6; part 3 as option (c) under defaults 3 and 4, its served-loader-error half under default 1. No new app-facing API.

**Context.** The recorder's reactive scope belonged to the component that called `record`; disposing that component stopped recording silently and turned a failed upload into an unhandled rejection. The k.server write proof refuses cross-site uploads, and nothing said so. An error reported before any component could call `record`, including a server loader error rendered into an island page, was lost.

**Decision.**
- **Detached scope (k.reactive).** `scope(fn, { detached: true })` is a root: no `parent`, no outer disposal or `onError`, `fn` untracked with writes still checked; only its own `dispose()` ends it. It escapes `uses` and the request store registry, so check rule **E1207** refuses `detached` or a non-literal options object in app code (no fix).
- **Recorder (std.sessions).** Its scope is detached with its own `onError` (a throw lands in `errors()`); `stop()` disposes it and a later `record` starts fresh. A non-2xx, rejected or throwing put is `sessions.putFailed`, recorded, never thrown.
- **Same-origin uploads (E2006).** The recording app serves `@keel/std-sessions/routes` itself. `record` throws E2006 unless `upload` is credential-free http(s) on the document's origin (`self.origin`, else `location.origin`; opaque has none). The real `put` checks the same and sends with `redirect: "error"`. apps/sessions `Home` records without an upload on an opaque page. No check rule: the page's origin is not in the source.
- **Kept errors (k.ctx).** The ctx keeps the first 16 `error` events since its current `nav`, observed or not; a `nav` clears them. Every new observer gets the `nav`, then the kept errors, each replayed with `at`, its report time. `Boundary` reports every catch.
- **Served loader error (k.runtime, k.server).** `#k-state` carries a failed loader's `{ code, message: code, data: { at? } }` and nothing else; `resume` reports it after the served `nav`.
- **The recorder and kept errors.** Before observing it seeds its matched values from the current `el:` and password field values, earlier redacted `tx:` payloads and the current route, and scrubs kept errors with them; when an `el:` element is gone a kept error keeps only its code and `data.at`. Errors any recorder on the ctx took are not taken again. A kept error's event and the base carry their report `at`.

**Alternatives.**
- `root(fn)`, rejected as a second way to make a scope; a separate link carrying `uses` and the registry, rejected as more surface than a rule.
- A ctx lifetime for the scope, rejected: a ctx has no disposal.
- Documentation only for same-origin, rejected by default 6; a forwarder route, rejected as a second path.
- (a) config-driven start and (b) a module `start` hook, rejected as new hand-written shapes.
- Keeping every event kind, rejected: `fire` and `resource` are hot paths.
- Blinding every kept error, rejected: scrubbing keeps the message when every value is known.
- Serializing the whole publicized loader error, rejected: it may hold values the page does not show.

**Consequences.**
- k.reactive gains `detached`, E1207 and three conformance clauses; k.ctx one sentence and two clauses; k.runtime the served `error` and one clause; std.sessions E2006 and one clause. Trims are listed in RFC 0074.
- `@keel/std-sessions` 7 kB, `@keel/std-sessions/commandJob` 8.5 kB and `@keel/check` 33 kB budgets, raised with the measured bytes.
- A late recorder's base state is the state when it started; an earlier value of a redacted field that has since changed is not known.
- A server loader error on an island page with no island in its error render is still not recorded.
