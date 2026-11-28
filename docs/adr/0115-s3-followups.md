# ADR-0115: module services unwrap the route's `Result`, `Io.build`, a stream cap, sound `accepts`, schedules and jobs validate, `resumeDocument`, k.deploy and k.openapi (RFC 0092)

**Status:** accepted by the orchestrator (2026-11-12) under the WORKFLOW RFC defaults.

**Context.** S3 left gaps between code and spec and a few unsafe defaults: undocumented error answers and E1006 for endpoints files; `node` documents in dev that never resume their islands; three k.topology clauses without evidence; one `KEEL_SECRET` whose reach is unstated; a cron day rule that differs from Vixie cron; unbounded event streams; E1562 dropped silently in CI; schedules and jobs that accept what they cannot run; an `accepts` unsound for open objects; stdlib routes dropped from the entries; module calls that decode the k.server envelope; MCP `build` writing no `.keel/` files or bundles; tests that resume server HTML by hand; a golden-2 call to its own app through `service({ base })`. k.topology, k.server and k.services were at the section limit.

**Decision.**
- A1: every route's error answer is the KeelError `{ code, message, data }`, which each `errors[status]` must accept; an endpoints file that throws is E1006, records no endpoint and fails `keel build`.
- A2: in dev a `node` deployable's document scripts `/@keel/entry.ts?d=<name>`, the resume entry over its islands; without `d` the path keeps its meaning.
- A3: a rejected runner `run` is a `keel.unexpected` `diag`; `KEEL_ORIGIN` is optional, `KEEL_PEER_<NAME>` required per other `node` deployable.
- A4: forwarding compares every header less the dropped ones; deploy files are proven by `keel build`; the `keel dev` clause spawns the binary from `packages/cli/conformance`.
- A5: one `KEEL_SECRET` makes an app's deployables one trust zone for caller identity; stated in k.deploy and the threat model.
- A6: a cron day field starting with `*` is unrestricted, as in Vixie cron.
- A7: `createApp({ maxStreams })`, default 1,000; one more open event stream is 503 `keel.busy` (`data: { limit }`) and runs no loader.
- A8: `keel check --base` with no readable surface of this `version` is W1568 and checks no E1562; the generated CI passes `--base` whenever it has a base ref; an unreadable `topology.ts` counts every pair as split.
- A9: `schedule()` throws E2554 for a `job` not in its queue or module, or a refused `input`; a fire stores its mark only on `ok`.
- A10: one runner owns a queue's storage, stated with its consequence; `job()` throws E2505 for `attempts` or `timeoutMs` that is not a positive integer.
- A11: an open object accepts a field it lacks only if that field accepts any value; a GET endpoint matches only a route with a loader.
- A12: the entries import a stdlib module's routes from its package's `./routes` export.
- A13: a browser module call that meets a 3xx is `api.status` with `status` 0.
- B1: a `module` service unwraps the route's `Result` (GET: `results[id]`) and decodes `ok` with `output`, a non-2xx `error` with `errors[status]`; the surface gains `version: 1`.
- B2: `Io.build` is the disk half of `build`, so `keel build` and MCP `build` run one path.
- B3: no programmatic `keel dev`; a test spawns `keel dev --port`.
- B4: `x-keel-forwarded` stays a plain loop guard that any client may send.
- B5: `resumeDocument(html, { routes, ctx? })` in `@keel/testing` returns the `render` handle; a resume warning is E1720.
- B6: E1567 reports a same-app `service({ base })`; golden-2's `recipes` calls `kitchen` through `service({ module: 'kitchen' })`.
- B7: `@keel/scaffold` re-based to 16.75kb for A8's CI step.
- B8: `keel check` reports E1559; `@keel/check` re-based to 42.5kb.
- B9: std-jobs tools follow namespace imports and match only `@keel/schema`'s `secret`; `@keel/std-jobs/tools` re-based to 2.75kb.
- New sections k.deploy (production entry, assets, deploy files) and k.openapi (OpenAPI import) take text out of k.topology, k.server and k.services.

**Alternatives.**
- One dev entry that resumes and mounts by page, or a port per deployable, rejected: ships the client router to node pages; breaks one origin.
- A new code for a rejected runner, rejected: a second code for an unexpected throw.
- A fixed stream cap, or 429, rejected: some deployments need more; the client did nothing wrong.
- An error for a missing base surface, rejected: fails every project's first pull request.
- Validating schedules in a check rule, rejected: `input` is a runtime value.
- A lease owner and expiry in storage, rejected: needs a `ctx.storage` compare-and-set the kernel lacks.
- Mapping an opaque redirect to 303, rejected: invents a status.
- Unwrapping only GET, or a `results` option, rejected: two decode shapes, or two spellings of one call.
- `Io.evaluate`, rejected: the Vite builds would stay outside MCP `build`.
- `startDev({ cwd, port })`, rejected: a second way to start dev.
- Signing `x-keel-forwarded`, rejected: protects no request and still needs an unsigned loop stop.
- `renderRoute` with an `html` option, or E1002 allowed in tests, rejected: one function with two meanings; raw HTML in every test.
- Recording `service({ base })` in the surface, rejected: only a match against this app's routes says which module it means.

**Consequences.**
- Module calls read the value their route returns; golden-1 and golden-2 schemas lose the envelope and the surfaces regenerate with `version: 1`.
- The first CI run after upgrading reports W1568 against the older base surface.
- Every k.topology and k.deploy clause gets a test; k.topology, k.server and k.services gain room.
- A cron with `*/n` in one day field and the other restricted fires on fewer days.
- E1567, W1568, E1720, E2505 and E2554 are new diagnostics; `keel.busy` is a new KeelError code.
- `apps/sessions` resumes its documents with `resumeDocument` and runs `keel check`.
