# RFC 0235: k.ledger-items: every rung rests on a run; clauses keyed by text; citations checked

Status: accepted (ADR-0257), accepted by the orchestrator on 2026-11-25, for the operator to confirm. Amends k.ledger (Ledger, Mutation, Justified survivors, File, Rules, two Conformance clauses), k.test-run (Run report, Writes, three clauses), k.evidence (`pii.json` row), the map; adds k.ledger-items. From the weakness triage's lane 03 (backlog 0719, 0992, 0999, 1054 with 0919, 1112).

## Decisions
- D1: a clause's or export's rung rests on a test a run report records `passed`. The report is per project, `reports/tests/run.json` (or `<i>-of-<k>.json` for a vitest shard), written by `@keel/testing` `writeTestReport` from `keel test` and from the repository's reporter. A test is identified by its file and the line vitest gives as its location, matched to the static test whose call spans that line. The file's `sha` ties the run to the text the ledger reads.
- D2: reports are produced per run and never committed. A committed report could go stale and would be one more claim to police. The committed ledger comes from one run of every project on the tree it is committed with, and CI checks that order: tests, then ledger.
- D3: a missing report, a stale file entry, or a file held in two reports gives no evidence (`none`) and one W1733 per project, naming the report. The same rule covers `reports/a11y.json`. Its "keep the committed rung" (`keptNoReport`) is removed, because a kept rung is a number no run produced.
- D4: a clause's item is `<section>#<key>`, `<key>` the first 8 hex digits of the SHA-256 of the bullet's normal form. The normal form is today's `normClause` plus dropping the final period: one definition for the key and for citation matching. `n` (position) is kept for display and for diagnostics. A reworded clause is a removal and an addition.
- D5: one citation form, `// Spec: <section>, clause "<quote>"`, one clause per line, inner `"` written `\"`, the quote closing at the first unescaped `"`. Any other `// Spec:` line, an unknown section, or a quote that equals no bullet is E1732, which names the nearest bullet. Identical bullets in one section are E1733.
- D6: a project is `.` and each `packages/<p>` and `apps/<a>` holding a `package.json`, named by its path. Run reports, a11y, mutation reports and `mutation-justified.json` are read per project. `mutation.packages` becomes `mutation.projects`, keyed by project name (`packages/cli`, `apps/golden-1`, `.`).
- D7 (0999): a test run writes under `reports/` only, and any `.keel/` file it writes holds `keel build`'s bytes. No new mechanism: the builder finds the cause.

## Problem
Every public number rests on the ledger, and four things today let it print a number no run produced.

1. **Rungs from text, not runs (1112).** `testEvidence.ts` builds one `TestRef` per `it`/`test` call that is not marked skip, with `passed: true` hard-coded in each `Evidence`. `buildLedger` reads only file text. A failing conformance case keeps its clause's rung in the ledger, and only the gate's own test run stands between the two. A runtime skip (`skipIf`, `ctx.skip()`), a `.only` elsewhere or a file that fails to load still counts. Only a11y items read run results (`reports/a11y.json`), and with no report present they keep the committed rung (`keptNoReport`).
2. **Clauses keyed by position (0719).** `specClauses` numbers bullets 1-based and `buildLedger` emits `${id}#${n}`. RFC 0230 inserted a bullet in k.services, and `--diff` showed "#11 proven to example": that was a different clause. Merging two k.privacy bullets did the same. `PII_SINKS.ts` names `k.privacy#7` and three other clauses by position, so `pii.json` can report the rung of the wrong clause.
3. **Unchecked citations (0992).** `citesClause` checks whether `"<clause>"` appears anywhere in a `// Spec:` block. A quote that matches nothing earns nothing and says nothing. Nine RFCs each left stale quotes that dropped a clause to `none`, and these were found only by reading reports. Of the 2,487 `// Spec:` lines in the tree, many quote Rules, Check or Flow paragraphs (not clauses), use labels (`Conformance "…"`, `Rules, "…"`) or put two quotes on one line. Some differ from the bullet only by `\"`.
4. **Apps' mutation unread (1054, 0919).** `tooling/mutate-justified.mjs` validates `apps/<name>/mutation-justified.json`, and the mutation runner takes `apps/<name>` units. `mutationClaims` reads `packages/<pkg>/reports/mutation/mutation.json` only, so an app's mutation never reaches the ledger.
5. **A test run that edits tracked files (0999).** In a clean checkout, the golden apps' `keel test` rewrites `apps/golden-1/.keel/surface.json` and `apps/sessions/.keel/surface.json`. A static search found no writer of `surface.json` reachable from `keel test`: `surfaceRun` is called only by `hostBuild`, and the one app test that builds (`serverSqlite.test.ts`) builds a temp copy. The likeliest reading is that the committed surfaces are stale against `packages/schema` and `normalize.ts` changes since 4040cff4, `generate --check` does not cover them, and some step in the pipeline runs `keel build`. The compiler plugin's `flush` also writes `.keel/*.json` during a vitest run, from the modules seen so far. That is the second place to look.

## Proposal
### Run report (k.test-run)
`writeTestReport(root, files, shard?)` writes `{ v: 1, files: { [path]: { sha, tests: [{ line, state }] } } }` to `<root>/reports/tests/run.json`, or to `<i>-of-<k>.json` for a sharded run. An unsharded write clears the folder's other files, and a sharded one clears `run.json` and other shard counts, so a full run never sits beside an old part. `keel test` calls it beside `writeA11yReport`. The repository's `KeelReporter` calls it at `onTestRunEnd`, and sets `includeTaskLocation` in `keelConfig` (`tooling/vitest-config.ts`). The turbo `test` task gains the output `reports/tests/**`, so a cache hit restores the report of the run that produced it. That run had the same inputs, so the restored report is still a run's.

The identity is the file plus the location line. Titles were rejected because `it.each`, template and loop titles cannot be computed statically. The ledger matches a report line to the one static test whose call spans it. Tests do not nest, so the match is unique. A loop or `each` gives several report tests at one call: passing needs one `passed` and no `failed`.

The `sha` is per test file, as mutation claims are per source file. The commit hash was rejected because it does not describe a dirty tree. A hash of every source was rejected because any edit anywhere would void every report. What the per-file `sha` does not catch, an implementation change after the run, the gate catches: CI runs tests and the ledger on one tree.

### Run evidence (k.ledger-items)
`testEvidence` keeps finding references and rungs from text. A `TestRef` is kept only when its file's report entry is fresh and its call holds a passing line. Missing, stale or doubled entries give W1733, one per project, at `<project>/reports/tests/`. A11y items follow the same rule: no `reports/a11y.json` gives `none` and a W1733. `keptNoReport` and its trailer count are removed.

### Clause key and citation (k.ledger-items)
One function, the normal form (today's `normClause` with the final period dropped), feeds both the key (`sha256(...).slice(0, 8)`) and the citation match (equality, not `includes`). Records carry `n`, and E1707 names `<section>#<n>` at the bullet's line. `--diff` needs no new code: `ledgerDiff` skips a committed item that no longer exists, and E1707 catches the new item at `none` in a covered section. `ledger-fresh` compares keys and prints `n` from the fresh records.

E1732 covers a malformed `// Spec:` line, an unknown section, or a quote that cites no bullet. It runs in every `keel ledger` mode, so `pnpm check` (through `ledger-fresh`) fails on it before a merge. Its message gives the quote's first six words and the nearest bullet, the one sharing the most distinct normal-form words, the earliest on a tie. It has no fix, because which bullet was meant is a judgement. E1733 flags identical bullets in one section, which would otherwise collapse into one item without notice.

### Projects
A project is the folder `keel ledger` runs in plus each `packages/<p>`, `apps/<a>` and `examples/<e>` with a `package.json`. It is named by its path from there, `.` for the folder itself, as `a11y:<project>:` already does (RFC 0233). The name keys `a11y` items, `mutation.projects` and W1733's path. `exports` keep their `pkg` folder-name label (k.ledger File). `mutationClaims` reads `<project>/reports/mutation/mutation.json` and `justifiedFiles` reads `<project>/mutation-justified.json`; claims stay keyed by path from the ledger's folder. An app author's own `keel ledger` in their app folder is the project `.`: its `reports/tests/`, `reports/a11y.json` and `reports/mutation/` are read the same way, and its installed libraries are listed beside it.

RFC 0163's `libraries` entry sits beside this unchanged. An installed library is not a project of the app's ledger: `libraries` lists it by package name with the `{ version, unsafe, hostElements }` of the ledger it ships, which its own runs produced (k.library Ledger). In the library's own folder, its `keel ledger` makes it the project `.`. The k.ledger File paragraph takes three edits on the main line's text: `keptNoReport` gives way to `none` with W1733, `mutation.packages` becomes `mutation.projects` keyed by project name, and `clauses` `item` is `<section>#<key>`.

### Writes (0999)
A test run writes under `reports/` only. `.keel/` files the compiler plugin writes during a test hold `keel build`'s bytes. The builder first runs `keel build` alone in a clean checkout to tell a stale commit from a test-time writer. If the plugin's partial `flush` is the cause, it writes nothing under `vitest` (the `KEEL_TEST` environment) and leaves the artifacts to `keel build`. Then `generate --check`, or `keel check`'s E1005, covers `surface.json`.

## Alternatives
- **Commit the reports.** Rejected (D2): another file to keep fresh and police, and one that can lie.
- **Key a clause by its text itself.** It would make the ledger file several times larger and diagnostics unreadable. A digest of the same normal form is as stable.
- **Carry a rename map through `--diff`.** It needs a person to write the map, and it carries evidence onto text no test quoted. Removal plus addition is the honest reading.
- **Per-file pass/fail instead of per test.** One failing case would void every clause its file cites, and a runtime skip would still count.
- **Keep `keptNoReport` for a11y.** It is the one remaining number no run produced. CI has every report at the ledger step.
- **Put E1732 in `structure-lint`.** The ledger already pairs headers with clauses. A second parser would be a second definition of the normal form.

## Spec diff
Applied in this commit.
- New k.ledger-items (`implemented`, about 1,880 tokens): Clause key, Citation, Projects, Run evidence, Rules (E1732, E1733, W1733), 14 clauses.
- k.ledger (to `implemented`; about 2,470 tokens): the clause item and the header form point to k.ledger-items, and "a passing test" points to Run evidence. Mutation and Justified survivors are per project. File gains `mutation.projects`, `clauses` by key and a11y with no report at `none`, and loses `keptNoReport`. Rules lists the new codes. The keptNoReport clause and its sibling are reworded because the behaviour changes. No other bullet's wording changes.
- k.test-run (to `implemented`; about 1,660 tokens): Run report, Summary (what `keel test`'s counts are, agreeing with the report; backlog 1120), Writes, four clauses.
- k.evidence (stays `conformance-covered`): the `pii.json` row reads each sink's clause by item.
- Map: k.ledger-items row; k.ledger and k.test-run `implemented`; E170x owner gains k.ledger-items. `spec.map` re-based from 1,570 to 1,590 and `docs.map` from 1,600 to 1,620 (the row).

## Conformance diff
By the `conformance-writer`, from the spec text only.
- `packages/cli/conformance/ledger-items-key.test.ts`: k.ledger-items clauses 1 to 3 and 8.
- `packages/cli/conformance/ledger-items-citation.test.ts`: clauses 4 to 7 (E1732).
- `packages/cli/conformance/ledger-items-runs.test.ts`: clauses 9 to 12 (run reports, W1733).
- `packages/cli/conformance/ledger-items-projects.test.ts`: clauses 13 and 14.
- `packages/cli/conformance/ledger-a11y-*.test.ts`: the two reworded k.ledger a11y clauses.
- `packages/testing/conformance/test-run-report.test.ts`: the k.test-run Run report clauses. The Summary clause goes in `packages/cli/conformance/test-run-summary.test.ts`. The Writes clause goes in `packages/cli/conformance/test-run-writes.test.ts`, which runs `keel test` in a git fixture.
- Existing ledger conformance (`packages/cli/conformance/ledger-*.test.ts` and any fixture asserting a rung) gains a `reports/tests/run.json` in its fixture. A rung now needs one, though no bullet's wording changes.
- Every `// Spec:` header in `packages/*/conformance/**` moves to the Citation form, in an `rfc:0235` commit (see Migration).

## Migration
No release, no migration notes. The builder rewrites the tree:
1. Every `// Spec:` header line, 2,606 in 1,450 files, of which 688 already open with `<id>, clause "`: a quote equal to a bullet becomes its own `// Spec: <id>, clause "<quote>"` line, with inner `"` escaped. A quote of another paragraph becomes a plain comment (`// k.claim Check: …`). A label form (`Conformance "…"`, `Rules, "…"`) is rewritten. The `conformance-writer` does this from the spec text with a one-off script, never kept in `tooling/`, and fixes by hand every quote the script cannot place.
2. `PII_SINKS.ts` names each clause by key, and `generate.mjs`'s `KERNEL_SINK_RUNGS` follows.
3. The committed ledger is regenerated on the main line after a full run.
4. CI's ledger steps move out of the `check` job into a `ledger` job that needs `test-shard`. Each shard uploads `**/reports/tests/*.json`, and the a11y `keel test` runs move into the new job. It downloads them, runs `pnpm ledger --diff`, `node tooling/ledger-fresh.mjs --runs` (today's `--a11y`, now covering every rung) and `pnpm evidence:report --check`. The `check` job keeps `ledger-fresh` without `--runs`, which compares item keys, `unsafe` and `negativeTypes` (what the tree alone decides) and fails on E1732 and E1733. `mutate-pr` runs the package tests it needs before `ledger --diff`.

## Token impact
- Spec: +1,730 (new section), +450 (k.test-run), about 0 (k.ledger: the moved header text pays for the edits), +15 (map row).
- `keel explain`: E1732, E1733 and W1733 entries, each under 300 tokens.
- `@keel/cli` and `@keel/testing`: one report reader and one writer; size measured in the build.

## Build plan
Order that keeps the main line green at each merge. Steps 2, 4, 5 and 6 touch no conformance file except to remove a skip marker; step 3 is the `conformance-writer`'s alone.
1. This commit: RFC, ADR, spec text. No conformance, no build.
2. Builder: the report writer only. `writeTestReport` in `@keel/testing`, `KeelReporter` and `keel test` writing it, `includeTaskLocation`, turbo `reports/tests/**`, CI shards uploading their reports. Nothing reads reports yet, so nothing changes.
3. `conformance-writer`, in `rfc:0235` commits: the new clauses, with skip markers; a `reports/tests/run.json` in each existing ledger fixture that asserts a rung (today's ledger ignores it, so those cases stay green); and the header migration above. Migrated headers still cite under today's `citesClause`, which normalizes `\"`, so the ledger does not move.
4. Builder: clause key, E1732 and E1733, `n` in records, `coverageGaps`, `ledger-compare`, `evidence.mjs`, `PII_SINKS`; the skip markers of k.ledger-items 1 to 8 come off; the ledger is regenerated after a full run.
5. Builder: run evidence and projects. The ledger reads reports, W1733, a11y `none`, `mutation.projects`, `examples/<e>`. CI's `ledger` job lands in the same commit, because from here a rung needs reports. Remaining skips come off, and the ledger is regenerated after a full run.
6. Builder: 0999. Find the writer, fix it, cover `surface.json` freshness; its clause's skip comes off.
Files: `packages/cli/src/internal/{buildLedger,testEvidence,specClauses,citesClause,specHeaders,normClause,coverageGaps,ledgerCommand,mutationClaims,justifiedFiles,PII_SINKS,testCommand}.ts`, `packages/check/src/internal/LedgerFileSchema.ts`, new `runReports.ts`; `packages/testing/src/writeTestReport.ts`; `packages/compiler/src/vite.ts` (if the cause); `tooling/{vitest-config.ts,vitest-reporter.ts,ledger-fresh.mjs,ledger-compare.mjs,evidence.mjs,generate.mjs,ci.source.json,turbo.source.json}`; `packages/check/src/internal/EXPLANATIONS.ts`; `docs/TESTING.md`; the `keel-testing` skill's code list; every `packages/*/conformance/**` header; `tooling/ledger/ledger.json` (regenerated, never hand-edited).

## For the operator
1. **Reports are not committed (D2).** Recommended: yes. The cost is that `pnpm ledger --diff` locally needs `pnpm test` first.
2. **A11y without a report is `none`, and `keptNoReport` is removed (D3).** This reverses part of RFC 0233. Recommended: yes, since it is the same rule as every other rung.
3. **`mutation.packages` is renamed `projects`, keyed by path (D6).** Recommended: yes, for one project key across the file.
4. **Quotes of non-clause paragraphs leave `// Spec:` lines (D5).** Recommended: yes. They earned nothing, and they hid stale quotes.
