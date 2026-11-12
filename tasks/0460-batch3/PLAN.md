# Task 0460: batch 3: formatter gate, follow-ups of batch 2, RFC 0091 small kernel shapes

**Spec:** k.check, k.head, k.router, k.topology, k.testing, k.component, k.runtime, k.schema, k.forms, k.cli, k.server · **Principles:** 1, 5, 12 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** open

## Decisions
- D1 (user, 2026-11-12: "finish up with 438 files") the seven files of 0438 are committed as the formatter writes them (6cfe27f): line wraps only. The cause is fixed in lane T1: generated and scratch paths leave Biome's view and `pnpm check` gains a repo-wide format gate.
- D2 (orchestrator) the mutation run of batch 2 (`pnpm mutate:changed --base e192395`) keeps running while these lanes work, on the user's instruction to work concurrently; lanes may slow it and its packages are measured on their state when each run starts.
- D3 (orchestrator) the items that need a kernel shape (0446, 0394, 0395, 0377, 0387, 0449, 0450) go through one RFC, 0091, drafted by a design agent under the WORKFLOW RFC defaults; the orchestrator accepts it and records each answer for the user to confirm or reverse.
- D4 (orchestrator, confirm or reverse) RFC 0091 (`docs/rfc/0091-friction-batch3.md`) is accepted with every recommended answer: A `fire` `focus`/`blur` move focus, the `focused` flag is the one query, E1719; B, C a `string` with `min` >= 1 refuses `''` and whitespace-only as rule `required`, no trim, no new option; D `keel dev --port N` (default 5173, a busy port is E1560, no fallback port); E an unreachable peer is 502 `keel.unreachable`, `api.network` to a `service()` caller; F names stay `[a-z][a-z0-9-]*`, the peer key maps `-` to `_` through one `peerKey`, scaffold E1352 uses the same name check; G `Box` `label` as `aria-label`, required with `as="nav"` or `as="aside"` (E1802), golden-1 and golden-2 gain landmark labels.

## Steps
- [x] 0 commit the seven 0438 files (6cfe27f)
- [x] 1 wave 1 lanes (T5's rule is in the tree, uncommitted until item G lands): T1 tooling: `biome.json` ignores, `tooling/format-check.mjs` in `pnpm check`, the two rfc:0090 conformance files formatted (0438, 0451) · T2 router: `title` `params` and `search` typed (0448) · T3 server: HEAD keeps `content-length` (0458); runtime-dom: resume-then-refresh keyed-row test (0459) · T4 check: E1005 names the command and prints after source diagnostics (0376) · T5 testing: `landmark-unique` (0397) · T6 design: `docs/rfc/0091-friction-batch3.md`
- [ ] 2 record batch 2's mutation scores when its run ends (tasks/0445-batch2/PLAN.md Next action)
- [ ] 3 accept RFC 0091, ADR, spec text, conformance-writer, implementation lanes
- [ ] 4 reviewer and red-team; findings to the backlog
- [ ] 5 ledger, budgets, changesets, backlog, handoff, push

## Notes
- T1 done: `tooling/format-check.mjs` (F0001 would reformat, F0002 unreadable; `fix:` names the command), wired into root `check`; `biome.json` ignores `**/.keel/**`, `**/reports/**`, `**/.stryker-tmp/**`; `docs/WORKFLOW.md` Format paragraph; tooling tests 18 pass. The gate fails on any lane's unformatted new file, so each lane's files are formatted by path before its commit.
- T3 done: a forwarded HEAD response keeps the peer's `content-length` unless it carried a `content-encoding` (server 482 pass, 17,556 B of 17,664); `runtime-dom/test/keyed-rows-resume.test.ts` (3 tests, one property) passes: a resumed list keeps row nodes and focus across a refresh, an insert and a removal. No finding.
- T5 done, UNCOMMITTED on purpose: `landmark-unique` in `packages/testing/src/internal/axe.ts` (rule id in `Violation.ts`, `test/landmark-unique.test.ts`, README rule list; testing 295 pass; its tests were written after the code). It finds a real defect: golden-2 has three unnamed `nav` landmarks (`BoxShell.tsx` `recipes.nav`, `recipes.locales`; `RecipeList.tsx` `recipes.filters`), 10 golden-2 tests fail, and `@keel/ui` `Box` has no prop to name a landmark. The rule is committed together with the `Box` name prop, which is RFC 0091 item G.
- T2 done: `manifest` infers `P` and `S` from each entry's `params` and `search` schemas; `title` gets them typed (a route without the schema keeps `unknown`); golden-2's three titles lost their hand annotations; router 274 pass, check 1033 pass, no bytes moved; k.head sentence updated.
- T4 done (0376 a, b): E1005 messages end `; run keel build`; E1005 and W1005 sort and group after every other code (`check/src/internal/artifactRank.ts`, `test/artifact-order.test.ts`); check 1033, cli 558 pass; check 42,667 B of 42,752. Part c not done: `surface.json` is written only by the cli's `surfaceRun` (a Vite SSR evaluation), which the compiler's plugin cannot call; refreshing it in dev and test needs the evaluator moved (filed 0461). Unverified: that `keel build` rewrites every `.keel/*.json`.

## Verification
- [ ] `pnpm check` (with the format gate), `pnpm test`, `pnpm build` green
- [ ] ledger not lowered, 0 uncovered; unsafe count unchanged
- [ ] `pnpm exec biome format .` reports nothing

## Next action
Collect the spec agent (RFC status, ADR-0114, Spec diff applied). Then conformance-writers for the RFC's new and changed files (list in its Conformance diff), commit as `rfc:0091`, then implementation lanes by package: testing (A), schema and forms (B, C), cli (D), server and services (E), compiler and scaffold (F), ui and the golden apps (G, with the held `landmark-unique` rule).
