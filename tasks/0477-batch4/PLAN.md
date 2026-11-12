# Task 0477: batch 4: S3 leftovers, RFC 0091 amendment, S4 prep, mutation for batches 2 and 3

**Spec:** k.topology, k.server, k.compat, std.jobs, std.schedules (S3 leftovers) · k.schema, k.forms, k.services, k.cli (amendment) · S4 sections per tasks/0310-s4-realtime/PLAN.md · **Principles:** 1, 5, 12 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 (user, 2026-11-12) the user agreed with the orchestrator's decisions of batches 2 and 3 and said to keep moving with subagents in parallel (S3 or other work).
- D2 (orchestrator, under D1) the three red-team findings that questioned RFC 0091 are answered in an Amendment to it: a blank value for an optional key is absent in `decodeStrings` (0468); the `keel.unreachable` to `api.network` mapping applies to `service({ module })` calls only, with a bounded body read (0471); `keel dev` without `--port` uses the port Vite resolves from the project's config (0466). 0470 is closed by the user (2026-11-12): a blank value does not meet `min` 1, in the importer's mapping too.
- D3 (orchestrator) the mutation run for batches 2 and 3 (`pnpm mutate:changed --base e192395`) runs in the background while lanes work, as the user asked for parallel work; a package that stops at its budget is resumed by a later run.
- D4 (user, 2026-11-12) `@keel/reactive` and `@keel/schema` stay hand-written; `docs/ARCHITECTURE.md`'s borrow table says `Build` for both. Borrowing a signals engine or a validator was weighed and not taken: Keel's rules (declared writes, cycle detection, the queryable graph, keyed rows) and the one-declaration derivations (generators, codecs, JSON Schema, `s.secret`) need the code that exists.

## Steps
- [ ] 1 lanes running: M mutation run · P S4 prep (spec sections, skeleton packages, deps, budgets, lane list in tasks/0310-s4-realtime/PLAN.md) · L S3 leftovers (0339-0344, 0346, 0348-0351, 0353, 0354, 0360, 0362-0364, 0366-0373, 0388, 0390, 0391: fix what needs no spec, sort the rest) · A RFC 0091 Amendment text and spec sentences (k.schema, k.forms, k.services, k.cli)
- [ ] 2 amendment: conformance-writer, then implementation (schema, services, cli)
- [ ] 3 S3 leftovers that need conformance: conformance-writer (0349 and what lane L lists), then fixes
- [ ] 4 S4: conformance-writers per lane, then the implementation batch (tracked in tasks/0310-s4-realtime/PLAN.md)
- [ ] 5 reviewer and red-team over this batch's diff; ledger, budgets, changesets, backlog, handoff, push

## Notes
- lane A done: Amendment in `docs/rfc/0091-friction-batch3.md` (AM-1 blank optional strings absent in `decodeStrings` and forms `coerceText`; AM-2 the `keel.unreachable` mapping for `module` services only, read bounded at 1 KiB on the stream since the server's 502 carries no `content-length`; AM-3 `keel dev` starts Vite in process and uses the config's `server.port`); spec sentences in k.schema, k.forms, k.services, k.cli; conformance committed (schema, forms `blank-optional-0091`, services `network-failure`, cli `dev-port-0091`: the cli file takes about 160 s). Consequences: a whitespace-only `KEEL_ORIGIN` reads as unset; a whitespace-only nullable key still fails `required`. Implementation agents running: AM-1 and AM-2 (schema, forms, services); AM-3 (cli).
- lane P done (committed): S4 prep; decisions D5-D16 and the lane table are in tasks/0310-s4-realtime/PLAN.md. To settle in S4's kernel or offline lane: what an outbox entry becomes on a 502 `keel.unreachable` (a `base` service now reports `api.status`, so `failed`, not `queued`). S4 conformance-writers running: k.sync (store, ctx, server), std.channels, std.live and std.offline; std.multi and std.conflicts next. S4 conformance is committed red (wip) and goes green lane by lane.

## Verification
- [ ] `pnpm check`, `pnpm test`, `pnpm build` green
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged
- [ ] mutation scores recorded for every package batches 2 and 3 changed

## Next action
Collect: lane L (S3 leftovers), lane M (mutation), the two amendment implementers, three S4 conformance-writers. Then the std.multi and std.conflicts writers, then S4 implementation: the kernel lane first (K1+K2, K4, K3 per the S4 plan), stdlib lanes as their needs land.
