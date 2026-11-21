# Task 0034: freeze review (G3)

**Spec:** all kernel sections · **Gate:** G3 · **Branch:** jdforsythe/test-impl · **Status:** open (review delivered; gate work planned) · **Evidence:** `docs/freeze-review.md`

## Deliverables
- [ ] `docs/freeze-review.md`: per-section coverage, one-way audit, extension points, untested/unstated lists, RFC list
- [ ] Status flips only where every Conformance clause has a full non-todo test (k.schema, k.forms; spec files and `spec/00-map.md`)
- [ ] Backlog items 0057-0068 filed for every gap the review names
- [ ] G3 exit: 18/18 sections `conformance-covered`, then `frozen`
- [ ] G3 exit: each of the six extension points used by >= 1 stdlib module
- [ ] G3 exit: two golden apps built by agent from spec + skill
- [ ] G3 exit: evals improving across >= 2 recorded runs

## Steps
1. [ ] Review written (<= 1,500 words) and status flips applied with evidence; `node tooling/budgets.mjs` ok.
2. [ ] Housekeeping without RFC: remove `packages/check/conformance/zz.test.ts.bak` (needs an `rfc:NNNN` commit: it sits under conformance/); mark implemented RFCs `Status: implemented` with ADRs; k.errors status line `implemented`.
3. [ ] One-way cleanups that need no RFC (review section 2, rows 9-13): forms handle methods behind a symbol, drop `Transaction.payload`, drop `plan()`, router internals to a subpath, single `Topology`/`StyleUsage` owner.
4. [ ] RFCs, in order (review section 5): 0044 router; schema `decode`; ctx `uuid`; ui styling + Button `label`; pending surface; k.cli `session` code; Rules triage; inspector hooks; conformance completion per section group.
5. [ ] Conformance completion via `conformance-writer` (one task per section group, each under its RFC): k.reactive, k.store, k.ctx, k.errors; k.compiler, k.component, k.runtime, k.ui; k.router, k.server, k.services; k.check, k.cli, k.module; k.scaffold, k.testing. Fix `schema/conformance/result.test.ts:87` (unawaited `fc.assert`) in the first.
6. [ ] Implement or delete every spec'd code with no trigger (review section 4 list), each with a fixture and clean counterpart.
7. [ ] Flip each section to `conformance-covered` as its group lands; re-run this review's mapping strictly.
8. [ ] Stdlib wave: one module per extension point (schema type, check rule, capability, manifest, inspector hook, formatter), each with a spec section under `spec/std/` and conformance.
9. [ ] Golden app 2 (agent-built from spec + skill; eval recorded).
10. [ ] Evals: rerun golden-1, golden-1-api, skill evals; record the trend.
11. [ ] Freeze: flip all kernel sections to `frozen` in one RFC'd commit; verification below green.

## Decisions
- D1: Strict verdict. A clause counts only when a non-todo test body asserts all of it; a test that asserts a weaker property (stand-in components, hardcoded code subsets, proxies for CLI runs, type-only checks where a diagnostic is spec'd) is PARTIAL and blocks the flip. Type-level `expectTypeOf` counts when the clause is a type property and the package tsconfig includes `conformance` (k.schema brands).
- D2: A clause may be covered by a test in another package's conformance dir (k.forms clause 7 by `server/conformance/post-invalid-formdata-422.test.ts:33`).
- D3: Rules codes are not Conformance clauses; untriggered codes do not block a flip but are listed and must be resolved before `frozen` (k.check Conformance 1 requires a fixture per kernel code).
- D4: k.schema flipped with clause 8 (`json`, rfc:0018, 95961ef) included.
- D5: Adding conformance tests to `implemented` sections needs a numbered RFC (`docs/RFC.md`; `rfc:0000` refused), so completion is batched per section group.

- D6 (2026-11-07, user): the freeze flip is held. No section moves to `frozen` until the full product is built and reviewed; this plan prepares the freeze RFC and re-audit only.
- D8 (2026-11-09, user): the kernel is **provisionally frozen**. Treat every kernel section as frozen in practice: a change needs an RFC with an ADR, a conformance update and a migration note, as today. The `frozen` status flip itself waits until the S stages (S1-S8) have exercised the kernel, so that a kernel gap found while building the stdlib is fixed in the kernel rather than worked around. Workarounds in stdlib or apps that exist only because a kernel change was avoided are a defect: file them and change the kernel. We are not public, so these changes carry no deprecation cost yet.
- D7 (2026-11-07, user): measurement-based size budgets (tooling/budgets.json `size`) may be re-based when a package legitimately grows, with the reason in the commit message; spec'd output and spec token budgets stay fixed.
- D8 (2026-11-07, user): 0114 resolved by a two-phase manifest (backlog 0114), not the `const to: Href` workaround.

## Verification
- [ ] `node tooling/budgets.mjs` ok
- [ ] `pnpm check` and `pnpm test` green
- [ ] Every `packages/*/conformance` suite green with 0 todo/skip
- [ ] `spec/00-map.md`: every kernel row `frozen`
- [ ] `ls spec/std/std.*.md` lists >= 6 sections, one per extension point
- [ ] Two golden-app eval results converged; eval trend recorded in `evals/results`
