# RFC 0143: explanations in their own entry of the checker

Status: implemented (ADR-0165)

## Problem
The main entry of `@keel/check` is 62,109 B gzip (bundled alone, minified esm, dependencies external, as `tooling/budgets.mjs` measures it). Its budget line was raised seven times in one day, from 54.5kb to 61.25kb, and a size pass found 318 B of safe dedup. Measured on 2026-11-18 in a scratch build outside the tree:

| part | chars | gzip alone | marginal gzip in the table |
| --- | --- | --- | --- |
| explanation table (`internal/EXPLANATIONS.ts`, 166 rows) | 33,210 B minified | 12,686 B | |
| Rules text column | 10,342 | 4,527 | 3,797 |
| reason (`why`) column, 99 of 166 rows non-empty | 8,129 | 3,872 | 3,317 |
| fix example column | 9,581 | 4,382 | 3,793 |
| `see` column | 1,368 | 332 | 315 |

About 20% of the entry is text that only `explain()` reads. `check()` never reads it: `EXPLANATIONS` has one importer, `src/explain.ts`. A diagnostic's `fix` is the rule's own edit rendered as a unified diff (k.check **Registry**, `fix`), not the table's fix example, so the compact `fix:` line OUTPUT.md promises needs none of the table. `format()` reads no explanation in any mode; the pretty rendering prints the same fields as compact.

Callers of `explain` today: `packages/cli/src/internal/explainCommand.ts`, the one source caller, which serves `keel explain`, the MCP `explain` tool and the LSP hover. Tests and suites: `packages/check/conformance/explain.test.ts`, `explain-and-fixture-per-code.test.ts`, `define-rule.test.ts`; `packages/std-brands/conformance/brands.test.ts`; `packages/check/test/mutants.test.ts` (from `../src/index.ts`), `topologyDiags.test.ts` and `complianceRules.test.ts` (from `../src/explain.ts`); `packages/std-sessions/test/group-replay.test.ts`; `packages/cli/test/mutation-cmd-build.test.ts`. The stdlib `tools` entries import `defineRule` and types from `@keel/check`, never `explain`.

A naive split does not work: `explain()` falls back to `registry`, and `internal/registry.ts` imports `KERNEL_RULES`, so an entry holding `explain` bundles every kernel rule. Measured: 40,164 B gzip for an entry that only re-exports today's `explain`, of which the table is a third.

## Proposal
One new section, `k.explain` (Explanations), status proposed. No existing section changes text.

### D1. The entry
`@keel/check/explain` exports `explain(code): string`. The file is `packages/check/src/explain.ts`, served by a `./explain` key in the package's `exports` (a subpath with no folder index is the file `src/<subpath>.ts`, as `tooling/budgets.mjs` resolves it). One export, named as its file.

### D2. Synchronous, and moved
`explain` stays synchronous and leaves the main entry: `@keel/check` no longer exports it.
- A thin re-export from `@keel/check` keeps every caller compiling and keeps the table in the main bundle: the split would measure the same 62 kB. Rejected.
- An async `explain()` on the main entry that loads the table with `import()`: esbuild with `bundle: true` and no splitting inlines a relative dynamic import, so the main budget still counts the table unless the import names the package itself; and every caller turns async (the LSP hover handler, the MCP tool, three conformance suites) for a lookup that is a map read. Rejected.
- A lazily built table behind a getter on the main entry: the strings are in the bundle whether or not the map is built. Rejected.

What breaks: `import { explain } from '@keel/check'` fails to resolve the name. One source file (`explainCommand.ts`) and the tests listed in Problem change one import line each. No behaviour changes: every code returns the text it returns today.

### D3. Registrations in a module of their own
`defineRule` writes stdlib rules into one small module that both entries import; the registry `check()` and `rules()` read is the kernel rules followed by that module's map, as today. `explain` reads the table, then that map, and imports no kernel rule. A kernel code is always in the table: the k.check bullet "Every E code in a kernel section's Rules or in `reportedCodes()` has an `explain` entry" holds today with no fallback needed (every code literal in the check sources has a row, checked on 2026-11-18). Both entries resolve to one file of the package in one process, so a rule registered through `@keel/check` is explained by `@keel/check/explain`.

### D4. What a diagnostic carries
Unchanged: `{ kind: 'diag', code, path, line, col, message, fix?, see? }`, each field from the rule and the pipeline. In the scratch build the main entry without `explain` contains none of the 166 fix examples and none of the 99 reason lines (the current entry contains all of them), so nothing on the `check()` path reads them. Compact, json and pretty output keep every byte they print today.

### D5. Budgets, not an accounting trick
Both entries get a size line, measured the same way, and the main line drops by what left it.

| entry | today | after (measured) | proposed limit |
| --- | --- | --- | --- |
| `@keel/check` | 62,109 B | 49,561 B | 50kb (51,200 B) |
| `@keel/check/explain` | | 12,819 B | 13.5kb (13,824 B) |

The two together are 62,380 B, 271 B more than today: the explain function and the registration module are counted in both lines. Headroom is 1,639 B on the main line and 1,005 B on the explain line, about 13 rows at the table's 76 B gzip per row. A raise of either line names the code or rows that caused it, as every budget raise does.

### D6. Conformance keeps holding
The k.check bullet on explanations and fixtures is unchanged; its suite imports `explain` from `@keel/check/explain` and `reportedCodes` from `@keel/check`. k.explain adds that the main entry holds no reason line or fix example, the explain entry holds every one, and the budget file names both entries.

## Known limits
- `@keel/cli` imports `explainCommand` with its operation table, so the `keel` binary loads the table on every command, `keel check` included. The CLI is one node process whose budget line measures it with dependencies external; a lazy load there is a CLI change, outside this RFC.
- A tool that bundles `@keel/check` and `@keel/check/explain` into two separate bundles gets two registration maps; `explain` in the second sees no stdlib rule registered through the first. Keel ships source modules and bundles neither.

## Step two: rules and project passes behind an entry
Measured alone (same build): the project-wide passes (`compatChecks`, `moduleChecks`, `prefixCollisions`, `guardRedirectLoops`) are 14,988 B gzip; the 42 rule files 28,754 B. `check()` is synchronous and runs every pass and every rule on each call, and every caller (the CLI, the LSP, MCP, the conformance suites) wants all of them. A second entry would move those bytes to another budget line while every caller still loads them: the accounting trick D5 rules out. It earns an RFC only when a caller appears that runs a subset, for example an LSP mode checking one file without project passes, or stdlib `tools` entries loaded without `check()`. Not proposed now.

## Spec diff
- New `spec/kernel/k.explain.md`, status proposed: intro, Entry, Diagnostics, Budgets, Rules (none), four Conformance bullets. 2,290 characters, 573 tokens.
- `spec/00-map.md`: a `k.explain` row (proposed) after `k.check`. Room made: both table delimiter rows to `|-|-|-|-|`; one-line cells `k.boundary` "stubs", `k.ctx` "clock", `k.user` and `k.compat` without code spans. 4,796 to 4,795 characters, 1,199 tokens.
- No conformance header quotes changed prose, so the conformance commit re-quotes nothing. k.check, k.cli and std.brands are unchanged.
- Codes: none new.

## Conformance diff
One `rfc:0143` commit by the `conformance-writer`, red:
- `packages/check/conformance/explain-entry.test.ts`: the four k.explain bullets. The bundle bullet bundles `packages/check/src/index.ts` and the `./explain` export target with esbuild (minify, esm, platform node, packages external) and, for each code in `reportedCodes()`, splits `explain(code)` into lines: each line other than the first and the `see:` line, a `fix:` line without its `fix: ` prefix, is absent from the main bundle and present in the explain bundle.
- Import lines only, no clause changes: `packages/check/conformance/explain.test.ts`, `explain-and-fixture-per-code.test.ts`, `define-rule.test.ts` and `packages/std-brands/conformance/brands.test.ts` import `explain` from `@keel/check/explain`.

## Migration
- `@keel/check`: `exports` gains `./explain`; `src/index.ts` drops the `explain` re-export; `src/explain.ts` reads the table and the registration module; `defineRule`, `rules()` and `reportedCodes()` read kernel rules plus that module. README Public API names the entry.
- `@keel/cli`: `explainCommand.ts` imports `explain` from `@keel/check/explain`.
- Tests: `packages/check/test/mutants.test.ts`, `packages/std-sessions/test/group-replay.test.ts`, `packages/cli/test/mutation-cmd-build.test.ts` change their import.
- `tooling/budgets.json`: `@keel/check` to 50kb, a `@keel/check/explain` line at 13.5kb, both `platform: node`.
- Changesets: `@keel/check` (the moved export, with the note below), `@keel/cli`.
- Migration note for code outside the repo: replace `import { explain } from '@keel/check'` with `import { explain } from '@keel/check/explain'`. The text returned is the same.

## Build order
1. This RFC, ADR-0165, k.explain and the map (commit 1).
2. `conformance-writer`: the Conformance diff, red (commit 2).
3. Builders: the Migration; k.explain to `implemented`, then `conformance-covered` when green.

## Token impact
k.explain 573 (new). Map 1,199 (was 1,199). No other section changes.

## Choices
Each is the author's call for the orchestrator to confirm or reverse.
- C1: the entry is `@keel/check/explain`, file `src/explain.ts` (D1). Runner-up: `@keel/check/explanations`, which names the data instead of the function it exports.
- C2: `explain` stays synchronous and moves; no re-export on the main entry (D2). Runner-up: none that keeps the split.
- C3: stdlib registrations move to a module both entries import, so the explain entry holds no kernel rule (D3). Runner-up: an explain entry that imports the registry, 40,164 B, rejected.
- C4: the main line drops to 50kb and the explain line starts at 13.5kb (D5).
- C5: step two is not proposed until a caller runs a subset of the checker.
