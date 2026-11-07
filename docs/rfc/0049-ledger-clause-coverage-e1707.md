# RFC 0049: the spec map cannot outrun the ledger (clause matching, E1707)

Status: accepted (ADR-0038)

## Problem
- **Reviewer finding (2026-11-07).** `spec/00-map.md` marked all 18 kernel sections `conformance-covered`, but the committed ledger rated 114 of 179 clauses `none`. Examples: k.compiler 11 of 14, k.cli 9 of 15, k.runtime 6 of 9, k.errors 8 of 8, k.services 9 of 9.
- **Why a correct-looking header gave `none`.** `buildLedger` joined every `Spec:` line of a file and tested `includes(clause)` on the raw text. So:
  - **Byte-exact match.** A header that dropped the clause's backticks (`mount onError receives ...`) or its period, or that used curly quotes or escaped inner quotes, did not match.
  - **Wrapped quotes.** A quote wrapped onto a second `//` line never matched: only lines containing `Spec:` were read.
  - **Clause numbers.** Most k.runtime, k.ui and k.ctx headers named clauses by number (`Conformance 7`). Numbers are not read, and they had drifted: the attr clause moved from 7 to 9.
  - **Unanchored containment.** Matching ignored which `Spec:` line named which section, and a quoted prefix of a longer clause counted for the shorter one.
- **Unreadable clause lists.** k.reactive, k.store, k.schema and k.component wrote Conformance as one inline paragraph. `specClauses` reads only `- ` bullets, so those four sections had no ledger items at all. A status claim with zero clauses could never be checked.
- **Headers that cited nothing.** 17 of 23 compiler conformance files had no header. 18 files used `// Clause:` (W1706). `compiler/conformance/ids-json.test.ts` is a stand-in whose clause is asserted in `testing/conformance/compiler-ids-find.test.ts`.
- **No gate.** Nothing tied a section's status to its clauses' rungs.

## Proposal
1. **Matching (cli, `buildLedger`).** A conformance file's header blocks are parsed by `specHeaders`:
   - A block starts at `// Spec: <id>` and takes the directly following `//` lines. It ends at the next `// Spec:` or `// Clause:` line, or at a gap.
   - The block cites a clause of section `<id>` (the id right after `Spec:`) when it contains the clause in straight double quotes (`citesClause`).
   - Comparison drops backticks, makes typographic quotes straight, collapses whitespace and ignores case and the final period (`normClause`).
   - A quoted prefix of a longer clause does not cite it. Clause numbers and unquoted text are not read: spec bullets are unnumbered and insertions renumber them.
   - Any package's conformance file may cite any section (tasks/0034-freeze D2).
2. **Atomic clause lists (spec).** The four inline Conformance paragraphs become bullet lists, split at the sentences and semicolons they already had, with the words unchanged:
   - k.reactive: 11 clauses;
   - k.store: 16;
   - k.schema: 11;
   - k.component: 5.

   k.forms clause 1 ("sends no request, sets an error on every invalid field, and focuses the first invalid field") is split into its three parts. Each part is asserted by its own file (`forms/conformance/submit-invalid-*.test.ts`).
3. **Headers.** Every `packages/*/conformance` file is audited against tasks/0034-freeze D1, the strict verdict. A file cites a clause only when its non-skipped tests assert all of it. Only `//` header lines change. 116 cites are added or rewritten, and all 18 `// Clause:` lines are rewritten to `// Spec:`, so W1706 is 0.
4. **Gate (E1707).** `keel ledger --diff` reports E1707 at the clause's line for each clause of a `conformance-covered` or `frozen` section rated `none`. It also reports E1707 at line 1 for such a section with no readable clause list.
   - With `--scope`, only sections with items in scope are checked.
   - The trailer gains `uncovered`.
   - CI already runs `pnpm ledger --diff`.
5. **Honest statuses.** Five sections go back to `implemented`, because at least one clause has no file that asserts all of it:

   | section | clause | gap |
   | --- | --- | --- |
   | k.cli | 2 (MCP input schema equals the operation's JSON Schema) | `surfaces.test.ts` compares fields, required keys and primitive types, not the schema |
   | k.check | 1 (explain entry and fixture per code) | split: the 120-token check is in `explain.test.ts`; `fixture-per-code.test.ts` exempts an explain-only list |
   | k.check | 3 (`keel check` json equals the compiler's) | in-process `format(check())`, a CLI proxy (D1) |
   | k.schema | 1 (`parse(encode(v))` for every type) | split: `round-trip.test.ts` omits json, closed objects and member unions, which other files cover |
   | k.ctx | 3 (register order in real, shell and sim) | after-`register` is asserted in sim only |
   | k.store | 12 (bad payload is a compile error) | type arguments pinned by hand; an overload change that lets `tx(add, { item: 1 })` compile still passes |

## Alternatives
- **Read clause numbers (`// Spec: k.runtime#5`).** Numbers drift when a clause is inserted, and evidence then moves to the wrong clause without any error. Quoted text fails loudly: the clause drops to `none`, and E1706 or E1707 fires.
- **Loose containment, no quotes.** Under loose containment, a header quoting "A tree attaches N listeners to its root" also cites the shorter clause "A tree attaches N listeners".
- **Let several files each cite part of one clause.** The ledger cannot check that the parts add up. Where the parts are already separate sentences, splitting the bullet says the same thing and keeps one file per clause.
- **E1707 in `keel check` or plain `keel ledger`.** `keel check` does not read tests. Plain `keel ledger` writes the ledger file, and failing it would block regenerating the ledger. The gate belongs beside E1706 in `--diff`.
- **Keep the statuses and file follow-up tests.** That repeats the finding. Principle 11: claims lag machinery.

## Spec diff
- **k.testing Ledger.** A conformance test in any package names its clause quoted verbatim. Backticks, quote style, spacing, case and the final period are ignored, and the quote may wrap onto the next `//` lines. `--diff` checks the clauses of `conformance-covered` and `frozen` sections.
- **k.testing Rules.** Adds `E1707`.
- **k.testing Conformance.** Adds "A `conformance-covered` section with a clause no conformance test cites makes `keel ledger --diff` report E1707 at that clause's line."
- **k.check Codes.** Harness results become E1702-E1707.
- **Clause lists.** k.reactive, k.store, k.schema and k.component Conformance become bullets, and k.forms clause 1 becomes three bullets. The wording is unchanged.
- **Statuses.** k.cli, k.check, k.schema, k.ctx and k.store become `implemented`, in their section files and in `spec/00-map.md`.

## Conformance diff
- **Added** `packages/cli/conformance/ledger-diff-e1707-cli.test.ts`, written by conformance-writer. It runs the real binary over a tmpdir fixture:
  - a covered section with an uncited clause gives E1707 at its line and exit 1;
  - a verbatim cite clears it;
  - a number or a prefix does not;
  - a cite from another package's conformance dir does;
  - `implemented` gives no E1707.
- **Header-only edits** across `packages/*/conformance/**`, in 92 files: `//` lines only, no test body, import or assertion. Packages: check, cli, compiler, ctx, forms, reactive, router, runtime-dom, schema, server, services, std-brands, std-geo, std-health, std-money, std-report, std-timings, store, testing, ui.
- **Unit tests.** `cli/test/ledger-coverage.test.ts` is new. `mutation-cmd-ledger.test.ts` covers normalisation, wrapping, block attribution, prefixes, numbers and cross-package cites. `mutation-pure-spec.test.ts` covers clause lines.
- **Follow-up in `packages/check`** (held while a mutation run is in progress there):
  - add `"E1707"` to `EXPLAIN_ONLY` in `check/conformance/fixture-per-code.test.ts`;
  - add an `E1707` entry to `check/src/internal/EXPLANATIONS.ts`.

  Until then, that conformance test lists E1707 as unfixtured.

## Migration
- **Header form.** Write `// Spec: <id>, clause "<clause>"`, one line per clause, before the first statement. A clause number is not read.
- **Restoring a demoted section.** Add the missing assertion (the table above), cite it, and flip the status back in an RFC. E1707 then holds the claim.

## Token impact
- k.testing: 1,333 to 1,448.
- k.reactive: +6.
- k.store: +6.
- k.schema: +3.
- k.component: +2.
- k.forms: +13.
- k.check: -2.

All sections stay at or under 1,500.
