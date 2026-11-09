# RFC 0074: the recorder outlives its component, uploads are same-origin, first-load errors reach a late recorder

Status: accepted (ADR-0063, 2026-11-09). Parts 1 and 2 are accepted under the WORKFLOW RFC defaults 1 (a stdlib need that exposes a kernel gap is met by a kernel change), 2 (one way: extend `scope`, one upload path) and 6 (kernel-level enforcement over documentation). Part 3 is accepted as option (c) under defaults 3 (reuse the existing execution path: the observer channel already replays the current `nav`) and 4 (nothing new leaves the browser); it adds no app-facing API, so it needs no escalation. One follow-up in part 3 (the served loader error on an island page) is proposed and not implemented.

## Problem
Three gaps stand between std.sessions and the S1 exit (backlog 0251, 0253, 0256).
1. **Recorder lifetime.** `recording()` creates its reactive scope with `scope(fn)`, which is owned by whatever runs: the component that called `record`. When that component is disposed, the scope goes with it. Every later event then throws E1206 from `own.run`, the observer drops the throw, and recording stops silently. `record(ctx)` keeps returning the dead recorder, and a failed upload's `.then` calls the dead `onEvent`, so the throw becomes an unhandled rejection: a page error caused by the recorder.
2. **Upload origin.** The k.server write proof refuses a cross-site POST (403) and the CORS preflight gets 405, so a session posted to another origin never lands. Nothing said so, and `record` accepted any URL, so the failure was silent.
3. **First-load errors.** Island pages have no client router and no module startup hook. A Boundary catch during resume, or a loader error on a client deployable's first navigation, is reported before any component can call `record`, and `observe` replays only the current `nav` to a new observer. The error is lost.

## Proposal
### 1. A detached scope (k.reactive)
`scope(fn, { onError?, detached? })`. With `detached: true` the new scope is a root: its node has no owner (`parent` is undefined), so no outer disposal reaches it and no outer `onError` handles its effects' throws; `fn` runs untracked, as `Scope.run` runs (a disposed copy of the running computation: reads subscribe nothing, writes are still checked, E1201). Only the scope's own `dispose()` ends it.

This extends the one existing way to make a scope (principle 1) instead of adding `root(fn)`. The ctx has no lifetime of its own to tie the scope to, so the owner of a detached scope is whoever holds its handle; for std.sessions that is the recorder, and `stop()` disposes it.

std.sessions uses it: the recorder's scope is detached, so recording survives the component that started it; `stop()` disposes it and removes the ctx's entry, so a `record` after `stop()` starts a fresh recorder. Upload failures are handled in one place: a non-2xx `Result`, a rejected promise and a synchronous throw from `put` each become `sessions.putFailed` (status 0 when there is no response), recorded as an `error` event while recording, else only in `errors()`, and the handler cannot throw. `PutFailed` moves to `src/internal/PutFailed.ts` so the capability and the recorder share it.

### 2. Uploads are same-origin (std.sessions, E2006)
The one way (PLAN D1): an app that records mounts `@keel/std-sessions/routes` in its own `node` deployable (E2005 already requires node), and `upload` is that app, `new URL('/sessions', location.origin)`. There is no cross-origin upload and no forwarder; a central multi-app ingest is out of scope for S1.

`record(ctx, { upload })` throws E2006 at the call when `upload.origin` differs from `location.origin`, or the page's origin is opaque (`"null"`: `about:blank`, `file:`, a sandboxed frame). The error is `Error` with `code: "E2006"`, `see: "std.sessions"` and the one-line message `E2006 upload origin <o> is not the page's (<p>); serve routes here`, the shape k.reactive uses for its coded throws. Without a `document`, `record` stays the no-op it was and checks nothing, so server renders that pass an absolute URL keep working. A refused call leaves no recorder behind.

**No check rule.** A static rule cannot tell a cross-origin literal: the page's origin is the host's, not the source's. `upload` is a `URL`, so a literal is `new URL('https://…')`, which may be the app's own production origin; flagging every absolute literal would report correct code. The call-time guard is exact and fires on the first `record` in any happy-dom test or browser, which is where a check rule's value would be. Default 6 is met at run time.

### 3. Kept errors for a late observer (k.ctx)
Options weighed:
- **(a) Config-driven start.** `std['@keel/std-sessions']` gains `record: { upload?: string }`, marked client-readable by `clientStd` keys, and the generated resume and client entries call `record` when it is present. Recording would start before the first event, but it is a new hand-written config shape, and the compiler's generated entries would grow a stdlib-specific branch, or a general "start on boot" extension point that is a second way to run code at startup. It also adds nothing for an island page whose islands resume before the entry could act, since the entry already runs first.
- **(b) A module start hook.** `module({ start: (ctx) => void })`. A new hand-written API shape that every module author learns, an ordering question between modules (principle 2), and a general-purpose place for side effects at boot.
- **(c) Keep errors for a late observer.** The observer channel already replays the current `nav` to a new observer. It also keeps the `error` events reported since that `nav`, the first 16, and a new observer gets them right after the `nav`. A `nav` clears them. No app-facing API changes; `record` called from a component during resume, or after a client-side first navigation, still sees what failed before it.

**Recommendation: (c), implemented.** It is the smallest change, reuses the existing replay, and needs no new shape. Exact behaviour:
- `report(ctx, { kind: 'nav' })` sets the hub's `nav` and empties its kept errors; `report(ctx, { kind: 'error' })` appends to the kept errors while fewer than 16 are kept (`KEPT_ERRORS`), whether or not anything observes.
- `observe(ctx, fn)` delivers the current `nav`, then each kept error, each in its own try (a throw is dropped), before any live event.
- A `Boundary` reports every catch, not only when observed, so the ctx can keep it. The router already reported loader and action errors unconditionally.
- apps/sessions keeps starting its recorder in `Home` and relies on this: an error between the served route and Home's resume is recorded and uploaded.

The first 16, not the last: the first error is the one the fingerprint names. Every new observer gets the kept errors, not only the first observer, so a second std package observing first takes nothing from the recorder, and a recorder started after `stop()` gets the errors of its own base route.

**Follow-up, proposed (not implemented).** On an island page the loader runs on the server: its error renders the nearest errorElement into HTML and never reaches the browser's ctx, so neither (a), (b) nor (c) records it. Proposed shape, no app-facing API: `#k-state` carries the served loader error in its public form (`error`, as the errorElement already shows it), and `resume` reports it as an `error` right after the served `nav` (k.runtime Islands and resume, about 25 tokens, which needs trims there since k.runtime is at 1,498). With (c) a late recorder then sees it. A page whose error render has no island loads no JS and stays unrecorded.

## Alternatives
- **`root(fn)` in @keel/reactive.** A second way to create a scope; rejected by default 2.
- **Tie the scope to the ctx.** A ctx has no disposal; adding one is a new lifecycle for every capability. The recorder's `stop()` is the owner.
- **Document same-origin only.** Rejected by default 6: the guard is cheap and exact.
- **A same-origin forwarder route in std-sessions.** A second upload path; rejected by D1 and default 2.
- **Buffer every event until the first observer.** `fire` and `resource` are hot paths whose producers skip building an event when nothing observes; keeping them costs every unobserved page. Errors are rare, and only they are lost in practice.

## Spec diff
- **k.reactive** (708 -> 819 printed). **API**: `scope(fn, { onError?, detached? })`; "A `detached` scope is a root: it has no `parent`, runs `fn` untracked, takes no outer `onError`, and only its own `dispose()` disposes it." **Conformance**: "A `detached` scope created inside another scope has no `parent`, survives that scope's disposal with its effects still running, and its effect's throw reaches no outer `onError`; its `dispose()` disposes it." and "Reads inside a `detached` scope's `fn` do not register dependencies of an enclosing effect." Trimmed citation: `(rfc:0068)`.
- **k.ctx** (1,499 -> 1,498). **Observers**: "a new observer first gets the current one, then the `error` events reported since it (the first 16)". **Conformance**: "An `error` reported while nothing observes reaches a later observer right after the current `nav`, at most the first 16 since it; one reported before a later `nav` does not."
  - Trimmed citations: `(k.testing `TestEvent`)`; `, static: a ctx has no module identity` after E1156.
  - Trimmed examples: `` `Date['now']`, `` in the E1601 computed-key list (`` Date[`now`] `` stays).
  - Trimmed restatements: `; abort rejects with the reason` (the `after` conformance clause states it); `, no `uuid()`` (the `random` conformance clause states it); `(no `ctx[name]`)` after "the only access path"; `(a ctx's first access builds its mode's implementation)` after "lazy" (the register-order clause states the consequence); `: code from a string reaches every ambient` (rationale) after E1603.
- **std.sessions** (1,491 -> 1,498). **API**: "one per ctx until `stop()`"; "Uploads are same-origin (E2006): the recording app mounts `routes` in its `node` deployable." **Rules**: "E2006 a cross-origin `upload` to `record`." **Conformance**: "`record` throws E2006 on a cross-origin `upload`, not on a same-origin one."; "E2001-E2004 each fire …" and "E2005 fires …" merge into "E2001-E2005 each fire on a fixture, not on its clean twin."
  - Trimmed restatements: "Without `document` it is a no-op." (the server no-op conformance clause states it); `(unseeded: state may differ)` after `reproduced` (the base paragraph's `deterministic` states it); "until removing any one loses the fingerprint" in `minimize` (its conformance clause states it).
  - Trimmed example: ", ending `expect(rec.errors()).toEqual([])`" in `to-test`.
  - The recorder-lifetime clause ("recording continues after the component that started it is disposed") did not fit the 1,500 budget; it is a unit test (`packages/std-sessions/test/record-lifetime.test.ts`), with a `stop()`-then-`record` test and two upload-failure tests.

## Conformance diff
- Added `packages/reactive/conformance/scope-detached.test.ts`, `packages/ctx/conformance/observe-kept-errors.test.ts`, `packages/std-sessions/conformance/E2006-cross-origin-upload.test.ts`.
- Edited the `// Spec:` header of `packages/std-sessions/conformance/E2001-redact-path.test.ts`, `E2002-session-file-schema.test.ts`, `E2003-replay-input.test.ts`, `E2004-not-reproduced.test.ts` and `E2005-adapter-not-node.test.ts` to the merged clause.

## Migration
None for golden apps: no golden app calls `record`. Tests that passed an absolute upload URL under happy-dom (`https://example.test/sessions`, `http://localhost/sessions`) now pass `new URL('/sessions', location.origin)`. A browser app that uploaded to another origin got 403 before and gets E2006 at `record` now: mount `@keel/std-sessions/routes` in the app's own `node` deployable.

## Token impact
k.reactive 819, k.ctx 1,498, std.sessions 1,498 printed tokens, each under 1,500.

## Known limits
- Kept errors reach a late recorder stamped with the time it starts, not when they were reported: `CtxEvent` carries no time. Replay treats errors as observations, so the fingerprint is unaffected.
- A recorder started after an earlier one uploaded gets the same kept errors and, with `upload`, puts them again.
- A server-side loader error on an island page is not recorded (follow-up above).
- The detached recorder scope lives until `stop()`; a ctx never stopped keeps its recorder for the page's life, which is the intent.
