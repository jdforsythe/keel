# RFC 0196: k.ledger: justified mutation survivors

Status: implemented (ADR-0218). Amends k.ledger (Mutation, File, Rules; Conformance in the conformance commit).

## Problem
The P1 bar asks that every mutation survivor be killed or justified. Some survivors cannot be killed: an equivalent mutant (`i < n` to `i <= n` where index `n` reads `undefined` and the loop skips it), a defensive branch the types already exclude, a cache whose removal changes only speed. Today there is nowhere to write that down. A justification in a commit message or a code comment is invisible to the ledger, drifts from the code, and lets nobody tell a reviewed survivor from an unreviewed one.

## Proposal
### What a maintainer writes
`packages/<pkg>/mutation-justified.json` (or `apps/<name>/...`), checked in beside `stryker.config.mjs`:
```json
{
  "justified": [
    {
      "file": "src/internal/walk.ts",
      "mutator": "EqualityOperator",
      "original": "i < n",
      "replacement": "i <= n",
      "reason": "equivalent",
      "note": "Index n reads undefined, which the loop body skips."
    }
  ]
}
```
An entry names the mutant by file, Stryker's mutator name, the source text the mutant replaces and its replacement, never by line or column, which drift with every edit above them. Runs of white space count as one space, so a multi-line original fits on one line. `reason` is one of three: `equivalent` (no input tells the mutant from the source), `unreachable` (no input reaches the code), `performance` (only time or memory differ). `note` is one sentence.

### What the ledger does
An entry justifies each Survived or NoCoverage mutant of the package's report that has its four texts; a Killed or Timeout mutant is never justified. A claim gains `justified`, the count it covers in that file. A package's record gains `killed`, `survived`, `noCoverage`, `justified` (summed over its fresh claims) and `scoreJustified`, the score with the justified mutants left out of the count. E1713 still judges `score` against the threshold: a justification records a review, it does not lift a package over its floor. E1725 is a file that fails its shape, or, with a report on disk, an entry that justifies no mutant of it, so a file whose survivors were killed or whose code moved cannot rot.

### Until the ledger reads it
`node tooling/mutate-justified.mjs [--only <pkg>]` validates each file against its package's report (M0003 shape, M0002 an entry that matches no survivor, W0016 no report to check against) and runs in the nightly `ledger` job after the reports are in place. When `keel ledger` reports E1725 itself, the script's CI step is replaced by it.

## Alternatives
- **Line and column in the entry.** Rejected: every edit above a mutant moves it, and the file would need rewriting after unrelated changes.
- **Stryker's `// Stryker disable next-line <mutator>: <reason>` comments.** Rejected: the mutant becomes Ignored and drops out of the score and the report, so the ledger cannot count or audit it, a disabled line hides every later mutant of that mutator there, and the reason is free text with no set.
- **A section in `stryker.config.mjs`.** Rejected: the ledger reads data, not code, and a config module would have to be imported to be read.
- **Justified mutants count as killed toward the threshold.** Not taken; see For the operator.

## Spec diff
Applied in this commit to k.ledger: Mutation (a claim's `justified`), a new Justified survivors paragraph, File (the package record's counts and `scoreJustified`) and Rules (E1725). The Conformance bullets below land with their tests in the conformance commit, so the committed ledger and the spec's clause list change together.

## Conformance diff
Three clauses for the `conformance-writer`, added to k.ledger Conformance with their tests (fixtures under `packages/cli`, beside the existing mutation-claim suites):
1. "From a report with one Survived mutant and a `mutation-justified.json` entry naming its file, mutator, original and replacement, `keel ledger --write` stores that file's claim with `justified` 1 and the package's `scoreJustified` above its `score`, and `--diff` judges the threshold on `score`."
2. "An entry whose texts match only a Killed mutant, or no mutant, of the report on disk makes `keel ledger` report E1725 naming the entry."
3. "An entry without `note`, or with a `reason` outside `equivalent`, `unreachable` and `performance`, makes `keel ledger` report E1725 with or without a report on disk."

## Migration
None. No package has the file yet; without it every count of `justified` is 0 and `scoreJustified` equals `score`.

## Token impact
k.ledger grows by about 260 tokens, within the section budget. `pnpm budgets` passes.

## Build order
1. Conformance (`conformance-writer`), the three clauses above. 2. `@keel/cli` ledger: read the file, `justified` on claims, the package counts and `scoreJustified`, E1725 with its explanation. 3. `pnpm ledger` rewrites the committed ledger. 4. `tooling/evidence-report.mjs` and `docs/TESTING.md` show `justified` and `scoreJustified` per package; the nightly step moves to `keel ledger`.

## For the operator
One choice changes a gate: whether justified survivors may ever count toward a threshold. Built as NOT counting: thresholds stay on the plain score and `scoreJustified` is reported beside it. Counting them would let a package pass E1713 by writing entries instead of tests; the reason set and the rot check limit that, but a reviewer still has to read each entry. A later RFC can change it if the P1 audit asks for it.
