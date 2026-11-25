# ADR-0257: every rung rests on a run; clauses keyed by text; citations checked (RFC 0235)

**Status:** accepted (orchestrator, 2026-11-25).

**Context.** The ledger counted every unskipped test as passing, read from the test file's text, so a failing conformance case kept its rung. Clause items were keyed by bullet position, so inserting a bullet made `--diff` and `pii.json` read a different clause. Nothing checked that a `// Spec:` quote matched a bullet, and stale quotes silently dropped clauses to `none`. The ledger read mutation reports under `packages/` only, and a11y items with no report kept the committed rung.

**Decision.**
- A test is passing only when its project's run report (`reports/tests/run.json` or `<i>-of-<k>.json`, written by `@keel/testing` `writeTestReport` from `keel test` and the repository's reporter) holds its file at the current `sha` and holds, at a line inside its call, one `passed` and no `failed`. Otherwise it gives no evidence. A missing, stale or doubled entry is W1733 at the report. A11y with no report is `none`, and `keptNoReport` is removed.
- Reports are per run and not committed. The committed ledger comes from one run of every project on its tree, and CI runs tests, then the ledger.
- A clause's item is `<section>#<first 8 hex of sha256(normal form)>`. The normal form is backticks dropped, quotes straightened, spacing collapsed, lower case and final period dropped. The same form matches citations. `n` is for display only. A reword is a removal plus an addition.
- One citation form, `// Spec: <section>, clause "<quote>"`, one per line, with inner `"` escaped. Anything else on a `// Spec:` line, an unknown section, or an unmatched quote is E1732 with the nearest bullet. Identical bullets in a section are E1733.
- A project is the folder `keel ledger` runs in (`.`) or a `packages/<p>`, `apps/<a>` or `examples/<e>` in it, named by its path from there. An installed library is listed in `libraries` with the counts of its shipped ledger, not read as a project; in its own folder it is `.`. Run, a11y and mutation reports and `mutation-justified.json` are read per project, and `mutation.projects` replaces `mutation.packages`.
- A test run writes under `reports/` only, and any `.keel/` file it writes holds `keel build`'s bytes.

**Alternatives.** Committed reports, keys made of the text itself, a rename map through `--diff`, pass or fail per file, keeping `keptNoReport`, and E1732 in `structure-lint`. Each either adds a claim to police, carries evidence onto text no test quoted, or duplicates the normal form.

**Consequences.** Every `// Spec:` header in the tree is migrated, and `PII_SINKS` names clauses by key. CI's ledger steps move to a job after the test shards, which upload their reports. The turbo `test` task outputs `reports/tests/**`. A local `pnpm ledger --diff` needs `pnpm test` first. k.ledger and k.test-run read `implemented` until their new clauses are covered.
