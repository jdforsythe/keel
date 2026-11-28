# Task 0156 + follow-ups: red-team batch 5

**Spec:** k.server k.runtime (0156, 0160) · k.compiler k.ctx (0157, 0158, 0152, 0154) · k.compiler k.cli std.timings (0149, 0150, 0155, 0162) · **Gate:** G3 · **Branch:** jdforsythe/test-impl (Orca worktree test-impl) · **Status:** closed (2026-11-07)

## Deliverables
- [x] 0156 (agent A done: rfc:0060, ADR-0047; compileSelector subset tag/*/#id/.class/[name]/[name=value]/lists; ServerControl/Input/Select/TextArea/Option; HTMLInputElement global; errorElement in a render unit; golden-1/2 ssrNode tests under plain node; server budget 12 → 13.5 kB, 13,662 B, D7; follow-ups 0165, 0166 filed) server DOM supports what compiled templates call (`querySelector('[id="…"]')` at least); one golden SSR test runs in the plain node environment (server)
- [x] 0160 (agent A: x-forwarded-proto https upgrade-only when `secure` unset; W1557 on a production start without `secure`; fixation documented) `secure` detection: `x-forwarded-proto: https` upgrade-only, or a diag on an http request carrying it; fixation documented or mitigated (server)
- [x] 0157 (agent B done: rfc:0058, ADR-0048; script/style keep literal text and literal attributes only, any expression child or bound/spread attribute is E1002, lowering never binds into them) E1002 on any child or bound attribute of `script`/`style` in JSX (compiler)
- [x] 0158 (agent B: `http-equiv` refused on `meta`, E1003 with removal fix) `http-equiv` refused like `<base href>` (runtime-dom, compiler)
- [x] 0154 (agent B: resolver moved to packages/compiler/src/globals, exported at `@keel/compiler/internal`; constant folding, const following, execCommand insertHTML; compiler budget 21 → 24 kB, 22,739 B, D7) E1002 resolves names through the shared `globalRefs`; `execCommand('insertHTML')` (compiler, check)
- [x] 0152 (agent B: Temporal.Now, Intl.DateTimeFormat without argument, performance.timeOrigin, sendBeacon; function .constructor, Function.prototype.constructor, data: import) E1601/E1603 families extended: Temporal, Intl.DateTimeFormat without argument, performance.timeOrigin, sendBeacon; Function via constructor, data: import (check)
- [x] 0149 (agent C done: check compiles each project with its own topology.ts; workspace-same-diagnostics conformance) per-project topology when checking from a workspace root (cli, compiler)
- [x] 0150 (agent C: `@keel/compiler/routes` buildRoutes shared with the Vite plugin; keel build writes routes.json for node-only projects; rewrite prints W1005, keel check is the gate) routes.json compared in `keel build` for node-only projects (cli, compiler)
- [x] 0155 (agent C: rfc:0059, ADR-0049; `routeLiterals` reads routes.ts with oxc; literal mismatch E1005, non-literal parts W1005 named; golden apps print no W1005; old artifact-routes-w1005.test.ts removed, replaced by artifact-routes-literals) routes.json literal ids/paths compared statically; W1005 only for non-literal manifests (check, compiler)
- [x] 0162 (agent C: LRU eviction at 256 with a `dropped` count in `TimingsRecent`; std.timings clause changed in rfc:0059) timings cap evicts least-recent or counts dropped names in `timings.recent` (std-timings)

## Steps
1. [x] PLAN; three agents in parallel: A server (0156, 0160); B rules (0157, 0158, 0154, 0152: compiler rules/*, lowerFile, runtime-dom url/, check rules + globalRefs); C artifacts (0149, 0150, 0155, 0162: cli, compiler artifactHashes/vite/listSources/build, check check.ts/generatedEdits/CheckOptions, std-timings).
2. [x] Root `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 412 items, 367 verified, 6 unsafe, 0 lowered, 0 uncovered`; docs A11Y-TARGET/BETS/PRINCIPLES/VISION re-read, verified bumped (D0001). Reviewer + red-team running.
3. [x] 0167/0168/0169 fixed in-batch (every element class clones as itself; SVG raw text set once as text data; a topology.ts under modules/ is not a project root, projectDirs shared by build and check); final `ok check 41 tasks` · `ok test 39 tasks` · `ok ledger --diff 413 items, 367 verified, 6 unsafe, 0 lowered, 0 uncovered`; two code commits (rfc:0058+0059 cluster sharing compiler package.json, k.compiler.md, EXPLANATIONS.ts; rfc:0060 server) plus docs bumps; commit by path (rfc:0058/0059), flip backlog, handoff, push.

## Decisions
- D1: Ownership as in step 1; within packages/compiler, B owns `src/internal/rules/**` and `lowerFile.ts`, C owns `artifactHashes.ts`, `vite.ts`, `internal/listSources.ts`, `internal/isSourcePath.ts` and build paths; within packages/check, B owns `src/rules/**`, `src/internal/{globalRefs,ResolvedGlobals,unwrapExpression}.ts`, C owns `check.ts`, `internal/generatedEdits.ts`, `types/CheckOptions.ts`; both may add lines to EXPLANATIONS/KERNEL_RULES for their own codes.
- D2: RFCs landed: 0058 (B, ADR-0048), 0059 (C, ADR-0049), 0060 (A, ADR-0047). Budgets re-based (D7): server 13.5 kB (selector subset + form controls, 13,662 B), compiler 24 kB (resolver moved in, 22,739 B).

- D3: red-team batch 5 filed 0167-0172; 0167 (control subclasses lost on cloneNode), 0168 (SVG raw text escaped twice), 0169 (nested topology.ts as project root) are fixed in-batch by agents A, B, C; 0170 (let/var keys, Object.assign with an object), 0171 (blob: URLs, getPrototypeOf constructor), 0172 (LRU thrash under 256 unique request names) stay as follow-ups with 0165, 0166.

## Verification
- [x] `pnpm check`, `pnpm test` green; `pnpm ledger --diff` 0 lowered, 0 uncovered; unsafe 6 or justified
- [x] each backlog repro is a failing-then-passing test

## Trailer
`ok check 41 tasks` · `ok test 39 tasks` · `ok voice-lint 1441 files` · `ok budgets 46 measured` · `ok ledger --diff 413 items, 367 verified, 6 unsafe, 0 warnings, 0 lowered, 0 uncovered`

## Next action
None; closed. Batch 6: 0165, 0166, 0170, 0171, 0172, then 0138.