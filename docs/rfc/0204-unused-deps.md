# RFC 0204: k.module: a `deps` entry the module does not use is E1165

Status: accepted (ADR-0226), accepted by the orchestrator on 2026-11-23, for the operator to confirm. Amends k.module (`deps`, Checks, Rules, Conformance), k.scaffold (Codemods, Conformance), the map. From `apps/household` (walkthrough finding L9-5, backlog 1037).

## Decisions
- D1: one new code, E1165: a `deps` entry, other than a `@keel/std-*` package, that the module does not use. An error, at the entry, with a fix that removes it.
- D2: "uses" is the mirror of E1152: an entry is used when E1152 would ask for it. A non-test file of the module (generated ones among them) imports from that module, by a static, type-only, re-exporting or literal dynamic import, the contract's among them; or a binding of either module names a layout of the other.
- D3: `@keel/std-*` entries are out of the rule. Listing one is its use: its `./tools` rules, its `std` config, its routes and its manifest all key on the entry, with no import.
- D4: `keel codemod move` removes each entry the move leaves unused, as it adds each the move makes needed, so the k.scaffold Guarantee holds.
- D5: E1153 is unchanged. A cycle through unused entries reports E1153 and one E1165 per unused entry, so the fix that breaks the cycle is on the screen.

## Problem
In `apps/household`, `setup` gained `shopping` in `deps` (the setup page shows the runs) and `keel check` reported `E1153 module deps cycle: receipts -> setup -> shopping -> receipts`. `shopping` listed `setup` and `receipts`, and `receipts` listed `setup`, with no import behind any of the three. Removing `shopping`'s two fixed it. Each of the three entries was written when it seemed needed and outlived the code that needed it; `keel check` was clean the whole time, because E1152 reports a missing entry and nothing reports a surplus one.

What the tree does today:
- `moduleChecks` (`packages/check/src/internal/modules/moduleChecks.ts`) reads every non-test file of a module, resolves its imports (`resolveImport`: relative specifiers into `modules/<id>/`, `@keel/std-x/<File>`) and its bindings' `layout` values, and reports E1152 for an import or layout whose module is not in `deps`. `scanFile` collects static imports, `import type`, `export ... from` and literal `import()` alike. Test files are skipped (`isTestPath`), so a test needs no `deps`.
- `depsCycles` builds the graph from every `deps` entry naming a discovered module with a readable manifest, used or not. So an unused entry is an edge, and E1153 can stand on edges no code needs.
- E1154 is the same shape on `public.exports`: a declared name nothing backs, an error with a fix that removes it.
- `keel codemod move` (`opMove`) adds the `deps` entries a move needs (the target gains what the file imports, importers gain the target) and removes none. Moving the only file of `a` that imports from `b` leaves `a`'s `b` entry behind, unused.

A grep-level survey of the tree (each app-module `deps` entry against the relative imports and `layout` bindings of the module's non-test files, and the layout direction back):
- `apps/household`: `receipts` lists `setup`, and no file of `receipts` imports from `setup`. This one raises E1165 today.
- `apps/golden-1`, `apps/golden-2`, `apps/inspector`, `apps/sessions`, every `examples/*` app, `tooling/fixtures/*`, `packages/std-sessions/{conformance,test}/fixtures`: none.
- `keel scaffold module` writes `deps: []`; `keel scaffold project`'s module `app` likewise. No generator writes an entry.

## Proposal
### What a module uses
A module uses an app module its `deps` list when:
1. a non-test file of the module, a generated one among them, imports from that module: `import`, `import type`, `export ... from`, or `import('<literal>')`, an import of the module's contract among them (so `href` links and `service({ contract })` calls count through it, and a guard bound in `routes.ts` counts through its import); or
2. a binding of either module names a layout of the other (k.routes Layouts): the page's module may list the layout's, or the layout's module, which composes the page, may list the page's.

Those are exactly the entries E1152 asks for. A test file's import is not a use, as it needs no entry. Every other app-module entry is E1165, an entry naming a module the project lacks among them (nothing can import from it).

### Stdlib entries
A `@keel/std-*` entry is not judged. `keel check` imports the package's `./tools` for a module that lists it, and its rules run on that module (std.brands, std.i18n, std.copy E2406 key on the entry); its `std` config needs it (E1158); its `./routes` join the route table through it (k.topology); `deploy/compose.yaml` passes `KEEL_POSTGRES_URL` for `@keel/std-postgres` (k.deploy). Each of those is a use with no import. The rule stays where an entry means only "this code imports that code".

### The diagnostic
```
E1165 modules/receipts/module.ts:7:5 module receipts lists setup in deps and does not use it
  fix: remove 'setup' from deps
fail check 1 errors
```
At the entry, one per entry, in the manifest's file. The fix removes the entry with `removeEntryFix`, as E1154's does; no fix edits `node_modules/`. `keel explain E1165`:
```
E1165 a deps entry the module does not use
An app module in deps is one a non-test file of the module imports from, or whose layout a binding names either way (k.module Checks). Any other entry is an edge no code needs: it can close a deps cycle (E1153) that no import makes.
remove the entry from deps
```

### Error, not warning
The kernel is provisionally frozen: a kernel change goes through an RFC and an ADR, and no app is released, so a new check error needs no migration. The household's one entry is fixed in the build that adds the rule. Inside that, an error:
- A warning never fails a run (OUTPUT.md), and agents and CI read the exit code. The entries that hid the household's cycle were written one at a time, each with `keel check` green; a warning would leave them to pile up exactly so.
- E1154, the same surplus on `public.exports`, is an error with a removing fix. Two severities for one kind of stale declaration would be two ways.
- The cost is one ordering: an author who lists `deps` before writing the import sees E1165 until the import exists, as one who lists `public.exports` before the file sees E1154. The diagnostic carries the hunk that removes the entry.

### E1153
Unchanged. A cycle still reports once, at the smallest module's manifest. When unused entries carry it, each of them is also E1165, and applying those fixes clears the cycle. The household's case gives one E1153 and three E1165.

### The codemod
`keel codemod move F --to c` computes the uses of every module before and after the move and edits each manifest by both differences: it adds each entry a module needs after (as today) and removes each entry a module used before and does not use after. The three cases:
- `a` (F's module) loses F's imports: an entry `b` that only F used is removed.
- an importer `d` of F now imports from `c`: `d` gains `c`, and loses `a` when F was its one import from `a`.
- `c`, if it imported F, now imports its own file: its `a` entry goes when F was its one use.

An entry unused before the move is left alone; it was already E1165, and the Guarantee holds only from a clean check. `rename` renames entries, `place` touches no manifest, and no generator writes an entry, so nothing else changes. `@keel/scaffold`'s check proxy (`diagnose.ts`) gains E1165 beside E1151 to E1153, so an operation that would leave an unused entry is E1353, not a silent new error.

### What a removal changes
A deployable's generated CI job runs on its modules and the modules they list, transitively (`packages/scaffold/src/internal/deployWrites.ts`), so removing an entry can change a generated CI workflow; `keel check` then reports E1005 on it until `keel build` writes it again. E1152's fix, adding an entry, does the same today.

## Alternatives
- **A warning (W1165).** Rejected above: it does not stop the pile-up that hid the household's cycle, and E1154 is an error.
- **Judge stdlib entries too, by import.** `@keel/std-brands` exports nothing and is used only by being listed; every rule-only, config-only and route-only package would need an exception list. Not proposed.
- **Count test files as uses.** A test needs no entry (E1152 skips it), so its import cannot make one needed; counting it would keep production edges alive for test code.
- **Build E1153's graph from imports instead of `deps`.** Then `deps` would declare nothing the checker reads for cycles, and a second notion of edge would exist. The entry is the declaration; the rule keeps it honest.
- **Name the unused edges in E1153's message.** Helps only once a cycle exists, and leaves the entries in place in every other app.
- **Reuse E1157.** Retired; `keel explain E1157` names its replacement and codes are never renumbered. E1161 to E1164 are held by k.library (RFC 0163). E1165 is the next free code in k.module's block.

## Spec diff
Applied in this commit.
- k.module (to `implemented` until its conformance and build land): `deps` says an app entry is one the module uses and a stdlib entry is used by being listed; Checks defines "uses"; Rules gains E1165; Conformance gains five clauses (#16 to #20).
- k.scaffold (stays `implemented`): Codemods `move` adds and removes entries; Conformance gains one clause (#23).
- Map: the k.module row reads `implemented`. The `E115x` owner is already k.module.
- Ledger: k.module#16 to #20 and k.scaffold#23 at `none`.
- No glossary term is added; no section is added; no budget moves (k.module about 1,990 tokens, k.scaffold about 2,940, of 3,100).

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/module-E1165-unused-dep.test.ts`: k.module#16 to #20 over file maps, as `module-E1152-not-in-deps.test.ts` builds them (`module-support.ts`).
- `packages/check/conformance/fixtures-by-code.ts` and `fix-diffs.test.ts`: an E1165 fixture and its fix, since every Rules code needs one and every fix must apply and clear its code (k.check).
- `packages/scaffold/conformance/move-deps.test.ts`: k.scaffold#23.
- Existing cases: the check conformance tests select diagnostics by code (`codesOf`), so a fixture with an unused entry (`module-deterministic.test.ts`'s `orders` and `ghosts`, `contract-rules.test.ts`'s `a` listing `b`) gains an E1165 no assertion reads. The writer confirms any test asserting a whole clean check over such a fixture, in `packages/check`, `packages/cli` (`hosting-peer-binding.test.ts`: `app` lists `api`) and `packages/scaffold` conformance, and gives the fixture its import or drops the entry.

## Migration
None. No app is released; `apps/household`'s `receipts` drops `setup` in the build.

## Token impact
- Spec: k.module grows by about 465 tokens to about 1,990; k.scaffold by about 90 to about 2,940. The map is unchanged in size.
- `keel explain E1165`: one catalog entry, under the 300-token budget.
- `@keel/check`: one pass over data `moduleChecks` already holds; size to measure in the build against `@keel/check`'s 61.75 kB.

## Build plan
1. This commit: RFC, ADR, spec text, ledger rows. 2. `conformance-writer`: the six clauses. 3. Build:
- `packages/check/src/internal/modules/unusedDeps.ts` (new): from the `Scanned` list, the resolved modules of each module's imports and the layout pairs, E1165 per unused app entry with `removeEntryFix`; called from `moduleChecks.ts`. `PIPELINE_CODES.ts` gains E1165; `EXPLANATIONS.ts` its entry as above.
- `packages/scaffold/src/internal/opMove.ts`: uses before and after, removals into `ManifestChange` (a `removeDeps` set) and `editManifest.ts` applying them; `diagnose.ts` gains E1165.
- `apps/household/modules/receipts/module.ts`: drop `setup`.
- Docs: the `keel` skill's code list (`packages/cli/skills/keel/SKILL.md`, copied to `.claude/skills`), the `@keel/check` and `@keel/scaffold` READMEs, a changeset, `tasks/p1/walkthrough-findings.md` (L9-5), `tasks/BACKLOG.md`.

## For the operator
1. **E1165 is an error.** Recommended: yes; a warning lets unused entries pile up as they did in the household, and E1154 is the same kind of rule at error.
2. **Stdlib entries are not judged.** Recommended: yes; listing a stdlib package is its use (rules, config, routes, compose).
