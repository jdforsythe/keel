# Task 0253 + 0251 + 0256: S1 exit path

**Spec:** std.sessions (upload origin, recorder lifetime) · k.reactive (detached scope) · k.module / k.ctx (client start) · **Gate:** S1 exit · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open (2026-11-09)

## Deliverables
- [x] 0253 uploads are same-origin: spec and READMEs say so; an app that records mounts `@keel/std-sessions/routes` in its own node deployable and the Action's `url` is that app (one way; no cross-origin upload, no forwarder)
- [x] 0251 the recorder outlives the component that called `record`: a detached scope owned by the ctx (kernel, RFC); a failed upload never becomes an uncaught page error
- [x] 0256 first-load errors are recorded: design in the RFC; the API shape goes to the user before implementation if it is a new hand-written surface

## Steps
1. [x] One opus agent: rfc:0074 + ADR-0063 (0251 kernel change, 0253 text, 0256 proposal), conformance, implementation of 0251 and 0253; 0256 implemented only if it needs no new user-facing API.
2. [ ] Root checks; reviewer + red-team; commit; push.
3. [ ] User: pick a host for apps/sessions; deploy; live run.

## Decisions
- D1: 0253 is answered by the existing way: the recording app serves its own ingest routes (E2005 already requires node). A central multi-app ingest service is out of scope for S1.
- D2 (0251, rfc:0074 part 1): `scope(fn, { detached: true })` in @keel/reactive, a root scope (no parent, no outer disposal or onError, `fn` untracked) instead of a second `root()`; the ctx has no lifetime, so the recorder's `stop()` owns it. The recorder uses it; a non-2xx, rejected or throwing put is `sessions.putFailed` (status 0 without a response), never thrown. Recorder-lifetime clause did not fit std.sessions' 1,500 tokens: unit test `test/record-lifetime.test.ts`.
- D3 (0253, part 2): `record(ctx, { upload })` throws E2006 (`code`, `see`, one-line message) when `upload.origin` is not `location.origin` or the page origin is opaque; no check without `document`. No check rule: the page's origin is not in the source. Spec sentence, both READMEs, THREAT-MODEL updated.
- D4 (0256, part 3): option (c), no app-facing API. The ctx keeps the first 16 `error` events since its current `nav` (observed or not; a `nav` clears them) and every new observer gets them after the `nav`; `Boundary` reports every catch. apps/sessions keeps `record` in Home and relies on it (homeRecording tests). Options (a) config start and (b) module start hook rejected as new shapes. Follow-up proposed, not implemented: `#k-state` carries the served loader error and `resume` reports it after the served `nav` (an island page's server loader error never reaches the browser ctx).
- D5: `@keel/std-sessions` budget 6kb -> 6.5kb: measured 6,314 B gzip, up from 6,085 B (E2006 guard, upload failure handling).
- D6 (red-team 0264-0269, 0271, review; rfc:0074 amended): E1207 check rule refuses `scope(..., { detached })` or non-literal options in app code (paths under `packages/` are library code). Recorder scope has its own `onError`. E2006 uses `self.origin` (fallback `location.origin`), refuses `"null"`, non-http(s) (`blob:`) and credentials; the real put checks the origin and sends `redirect: "error"`; Home records without upload on an opaque page. Kept errors: the recorder seeds matched values from current `el:`/password field values, pre-base `tx:` payloads and the current route, scrubs kept errors; blinds them (message = code, data but `data.at` masked) when an `el:` element is gone. `takenErrors` (per ctx WeakSet of error objects) makes a kept error upload once. The hub stamps kept `nav` and errors with `at` (CtxEvent gains optional `at`); the recorder uses it for the base and the error event. Served loader error: `#k-state.error = { code, message: code, data: { at? } }` (packages/server page.ts), `resume` reports it after the nav. 0270 stays open.
- D7: budgets `@keel/std-sessions` 6.5kb -> 7kb (6,908 B), `@keel/std-sessions/commandJob` 8kb -> 8.5kb (8,568 B, was 7,949 B), `@keel/check` 32.5kb -> 33kb (33,420 B).

## Verification
- [ ] `pnpm check`, `pnpm test` green; ledger 0 lowered, 0 uncovered; unsafe 6

## Next action
Integrate rfc:0074 (root checks green per agent report); reviewer + red-team; decide on the served-loader-error follow-up (RFC 0074 part 3).
