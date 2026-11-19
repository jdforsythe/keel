# RFC 0074: the recorder outlives its component, uploads are same-origin, first-load errors reach a late recorder

Status: implemented. Accepted (ADR-0063, 2026-11-09), amended the same day after the review and red-team passes (backlog 0264-0269, 0271; 0270 stays open). Parts 1 and 2 apply the WORKFLOW RFC defaults 1 (a stdlib need that exposes a kernel gap is met by a kernel change), 2 (one way: extend `scope`, one upload path) and 6 (kernel-level enforcement over documentation). Part 3 is option (c) under defaults 3 (reuse the existing execution path: the observer channel already replays the current `nav`) and 4 (privacy by default: kept errors are scrubbed or blinded); its island-page half (the served loader error) is accepted under default 1. None of it adds an app-facing API, so nothing needed escalation.

## Problem
Three gaps stood between std.sessions and the S1 exit (backlog 0251, 0253, 0256).
1. **Recorder lifetime.** The recorder's reactive scope was owned by the component that called `record`. Disposing that component made every later event throw E1206 (dropped by the observer), so recording stopped silently, `record(ctx)` returned the dead recorder, and a failed upload's handler became an unhandled rejection.
2. **Upload origin.** The k.server write proof refuses a cross-site POST (403) and the preflight gets 405, so a session posted elsewhere never lands; `record` accepted any URL.
3. **First-load errors.** Island pages have no client router and no module startup hook. A Boundary catch during resume, a loader error on a client deployable's first navigation, or a server loader error rendered into an island page happened before any component could call `record`, and was lost.

## Proposal
### 1. A detached scope (k.reactive, E1207)
`scope(fn, { onError?, detached? })`. With `detached: true` the scope is a root: no owner (`parent` undefined), so no outer disposal reaches it and no outer `onError` takes its effects' throws (without its own, a throw rethrows from the commit that ran the effect); `fn` runs untracked, as `Scope.run` runs, with writes still checked (E1201). Only its own `dispose()` ends it. This extends the one way to make a scope instead of adding `root(fn)`.

Having no `parent`, a detached scope escapes its creator's `uses` declarations and the request store registry (both walk `parent`), and can outlive a route. So it is for kernel and stdlib code: check rule **E1207** (`@keel/check`, `noDetachedScope`, `see: k.reactive`, no fix) reports `scope` given `detached` (anything but the literal `false`, shorthand included) or a non-literal options object (identifier, call, spread) in app code. `scope` resolves by binding (any alias, a namespace import); a shadowing local is skipped. Message: `scope({ detached }) is for kernel and stdlib code; app scopes nest in their owner`. A path under `packages/` is not app code for this rule.

std.sessions uses it: the recorder's scope is detached with its own `onError`, which records a throw inside it (`keel.unexpected`, `data.at` `sessions.record`) in `errors()`, so it never surfaces at the app's `set` or `tx`. `stop()` disposes the scope and removes the ctx's entry, so a later `record` starts a fresh recorder. A non-2xx `Result`, a rejected promise and a synchronous throw from `put` each become `sessions.putFailed` (status 0 without a response), recorded and never thrown. `PutFailed` lives in `src/internal/PutFailed.ts`, shared by the capability and the recorder.

### 2. Uploads are same-origin (std.sessions, E2006)
The one way (PLAN D1): an app that records serves `@keel/std-sessions/routes` in its own `node` deployable (E2005) and uploads to itself. No cross-origin upload, no forwarder.

`record(ctx, { upload })` throws E2006 at the call unless `upload` is http or https, has no user name or password, and is on the document's origin: `self.origin` (opaque `"null"` in a sandboxed frame or on a `file:` page), else `location.origin`. An opaque page has no origin to upload to. The error is `Error` with `code: "E2006"`, `see: "std.sessions"` and a one-line message naming both origins. Without a `document`, `record` stays the no-op it was. The real `put` applies the same test itself (else `sessions.putFailed` status 0, nothing sent) and sends with `redirect: "error"`, so a same-origin path that redirects can never re-post a session elsewhere. apps/sessions `Home` reads the document's origin before calling `record`: on an opaque page it shows the path and records without an upload, so a render never throws E2006.

**No check rule for E2006.** The page's origin is the host's, not the source's: a literal `new URL('https://…')` may be the app's own production origin, so a static rule would report correct code. The call-time check is exact and fires on the first `record` in any happy-dom test or browser.

### 3. Kept errors for a late observer (k.ctx, k.runtime)
Options weighed:
- **(a) Config-driven start.** `std['@keel/std-sessions']` gains `record: { upload?: string }` (client-readable through `clientStd` keys) and the generated entries call `record` when present. A new hand-written config shape and a stdlib branch (or a general boot hook) in the compiler's entries.
- **(b) A module start hook.** `module({ start: (ctx) => void })`. A new hand-written API shape, an ordering question between modules (principle 2), and a general place for side effects at boot.
- **(c) Keep errors for a late observer.** The observer channel already replays the current `nav`; it also keeps the errors reported since it. No app-facing API changes.

**Chosen: (c).** Exact behaviour:
- `report(ctx, nav)` keeps the `nav` and empties the kept errors; `report(ctx, error)` keeps it while fewer than 16 are kept (`KEPT_ERRORS`), observed or not. Each kept event is stamped `at: ctx.clock.now()`.
- `observe(ctx, fn)` delivers the kept `nav`, then each kept error, each with its `at`, each in its own try, before any live event. A live event carries no `at` (`CtxEvent` gains an optional `at` on `nav` and `error`).
- A `Boundary` reports every catch, not only when observed.
- The first 16, not the last: the first error is the one the fingerprint names. Every new observer gets them, so one std package observing first takes nothing from another.

**Served loader error (k.runtime, k.server).** On an island page a loader runs on the server and its error renders the nearest errorElement; the browser's ctx never saw it. The document's `#k-state` now carries `error: { code, message: code, data: { at? } }` when a loader failed, and `resume` reports it right after the served `nav`, so the ctx keeps it and a late recorder records and uploads it. Only the code and a string `data.at` are serialized: the errorElement is app code and may show any part of the error or none, so the server sends nothing the page might not show (the message is the code; other `data` fields, `s.secret` values among them, never leave). A page whose error render has no island loads no JS and stays unrecorded.

**The recorder and kept errors.**
- *Scrubbing (0264).* A kept error may hold a value typed into a redacted field before the recorder attached, which it never saw. Before it observes, the recorder treats as already matched the current value of each element an `el:` entry names (by `id` or `data-k`, or the control inside it) and of every password field, the redacted `tx:` payloads still in store logs (`pull` redacts entries before the base too), and the current route's params and search (the replayed `nav`). A kept error is scrubbed with them like a live one. When an `el:` element is not in the document, a value typed into it cannot be known: a kept error's message becomes its code and every string or number in its `data` but `data.at` is masked (fail closed).
- *Once per ctx (0269).* The recorder remembers per ctx (`takenErrors`, a `WeakMap<Ctx, WeakSet>` of error objects) the errors any recorder on that ctx took, live or kept; a later recorder skips a kept one already taken, so `stop()` then `record` never uploads it again.
- *Time (0271).* A kept error's session event carries its report `at`, and a replayed `nav` gives the base its report `at`; the base state is still the state when the recorder started.

## Alternatives
- **`root(fn)` in @keel/reactive.** A second way to create a scope.
- **A detached scope that keeps its creator's `uses` and registry through a separate link.** More kernel surface for a mode only kernel and stdlib need; E1207 confines it instead.
- **Tie the scope to the ctx.** A ctx has no disposal.
- **Document same-origin only.** Rejected by default 6.
- **A forwarder route.** A second upload path; rejected by D1 and default 2.
- **Buffer every event kind.** `fire` and `resource` are hot paths whose producers skip building an event when nothing observes.
- **Blind every kept error.** Loses the message even when every redacted value is known; scrubbing with seeded values keeps it, and blinding covers only the unknowable case.
- **Serialize the publicized loader error whole.** Its `data` and message may hold values the errorElement chose not to show.

## Spec diff
- **k.reactive** (708 -> 936 printed). **API**: `scope(fn, { onError?, detached? })`; "A `detached` scope is a root: it has no `parent`, runs `fn` untracked, takes no outer `onError` (without its own, an effect's throw rethrows from the commit that ran it), and only its own `dispose()` disposes it. Having no `parent`, it escapes its creator's `uses` declarations and request store registry (k.store), so only kernel and stdlib code create one (E1207)." **Rules**: "`scope` given `detached: true` or a non-literal options object in app code is E1207." **Conformance**: the detached-scope clause, the untracked-`fn` clause, and "E1207 fires on `scope(fn, { detached: true })` and on `scope(fn, opts)` in app code, not on `scope(fn, { onError })` or in a kernel or stdlib package." Trimmed citation: `(rfc:0068)`.
- **k.ctx** (1,499 -> 1,489). **Observers**: "a new observer first gets the current one, then the `error` events reported since it (the first 16), both replayed with `at`, their report time". **Conformance**: "An `error` reported while nothing observes reaches a later observer right after the current `nav`, at most the first 16 since it; one reported before a later `nav` does not." and "A replayed `nav` or `error` carries `at`, its report time; a live one has none."
  - Trimmed citations: `(k.testing `TestEvent`)`; `, static: a ctx has no module identity` after E1156; the sentence "A module calling `observe` lists it in `capabilities` (E1156)." (k.module states E1156 for `observe`).
  - Trimmed examples: `` `Date['now']`, `` and `` `` Date[`now`] ``, `` in the computed-key list (now "a `const` string too"); `(`const D = Date`, a parameter default, `const { random } = Math`)`, now "(aliases, parameter defaults, destructuring)" (the alias conformance clauses state each); `(`URL.createObjectURL`)` after `blob:` URL.
  - Trimmed restatements: `; abort rejects with the reason`; `, no `uuid()``; `(no `ctx[name]`)`; `(a ctx's first access builds its mode's implementation)`; `: code from a string reaches every ambient`; `, so a local `Date` is not the global` (the `const Date = ctx.clock` conformance clause states it).
- **k.runtime** (1,498 -> 1,493). **Islands and resume**: `#k-state` holds "... the served `route` ..., and a failed loader's `error` (`code`, `data.at` only)"; "`resume` first reports `route` as a `nav`, then that `error`". **Conformance**: "After resume of a page whose loader failed, an observer gets the served `nav`, then its `error` with only `code` and `data.at`."
  - Trimmed citations: `(k.ctx)` after `ctx` in `mount` and after `nav` in resume; `(k.errors)`; `(k.store)` after store snapshots; `, or k.ui` after "from the template".
  - Trimmed restatements: ", which `createApp` serves and Vite resolves" (the `createApp` entry clause states it); ", which the Vite plugin generates from the deployable's `routes.ts`" (k.compiler states it); "The harness `fire(id, event)` uses the same table." (k.testing states it); "Focus is kept." (the island-resume clause states it).
- **std.sessions** (1,491 -> 1,498). **API**: "one per ctx until `stop()`"; "Uploads are same-origin (E2006): the recording app serves `routes` itself." **Rules**: "E2006 a `record` `upload` not credential-free http(s) on the page's origin." **Conformance**: "`record` throws E2006 on a cross-origin `upload`, not on a same-origin one."; "E2001-E2004 each fire …" and "E2005 fires …" merge into "E2001-E2005 each fire on a fixture, not on its clean twin."
  - Trimmed restatements: "Without `document` it is a no-op." (the server no-op clause); `(unseeded: state may differ)`; "until removing any one loses the fingerprint" (the `minimize` clause).
  - Trimmed examples: ", ending `expect(rec.errors()).toEqual([])`"; `(string arrays)` after the config keys (the config schema states it).
  - The recorder-lifetime clause did not fit; it is a unit test (`test/record-lifetime.test.ts`), with the `stop()`-then-`record`, upload-failure, kept-error, origin and first-load tests (`kept-errors`, `upload-origin`, `upload-opaque`, `first-load`).

## Conformance diff
- Added `packages/reactive/conformance/scope-detached.test.ts`, `packages/ctx/conformance/observe-kept-errors.test.ts`, `packages/ctx/conformance/observe-replay-at.test.ts`, `packages/runtime-dom/conformance/resume-served-error.test.ts`, `packages/std-sessions/conformance/E2006-cross-origin-upload.test.ts`, `packages/check/conformance/E1207-detached-scope.test.ts`.
- Edited `packages/check/conformance/fixtures-by-code.ts` (E1207 fixture and clean twin) and `fix-diffs.test.ts` (E1207 has no fix).
- Edited the `// Spec:` header of `packages/std-sessions/conformance/E2001-redact-path.test.ts`, `E2002-session-file-schema.test.ts`, `E2003-replay-input.test.ts`, `E2004-not-reproduced.test.ts` and `E2005-adapter-not-node.test.ts` to the merged clause (backlog 0270 tracks the ledger counting one citing file as cover).

## Migration
None for golden apps: none calls `record` or creates a detached scope. Tests that passed an absolute upload URL under happy-dom now pass `new URL('/sessions', location.origin)`; a node test of the real `put` stubs `location`. A browser app that uploaded to another origin got 403 before and gets E2006 at `record` now: serve `@keel/std-sessions/routes` in the app's own `node` deployable.

## Token impact
k.reactive 936, k.ctx 1,489, k.runtime 1,493, std.sessions 1,498 printed tokens, each under 1,500. The E1207 `explain` entry is under 120 tokens.

## Size
Measured gzip against `tooling/budgets.json`, raised with these numbers: `@keel/std-sessions` 6,908 B (was 6,085 B before this RFC; budget 6 kB -> 7 kB), `@keel/std-sessions/commandJob` 8,568 B (was 7,949 B; 8 kB -> 8.5 kB), `@keel/check` 33,420 B (32.5 kB -> 33 kB). `@keel/reactive`, `@keel/ctx`, `@keel/runtime-dom` and `@keel/server` stay within theirs.

## Known limits
- The base state of a late recorder is the state when it started, not at the replayed `nav`.
- A value typed into a redacted field and then changed before the recorder started is not known; only the current value is seeded, and a kept error naming the old value keeps it. Blinding covers only a missing element.
- A server loader error on an island page whose error render has no island is not recorded: the page loads no JS.
- The detached recorder scope lives until `stop()`; a ctx never stopped keeps its recorder for the page's life, which is the intent.
- E1207 treats every path under `packages/` as library code.
