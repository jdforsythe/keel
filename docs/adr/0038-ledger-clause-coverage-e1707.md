# ADR-0038: Clause cites are quoted text, and E1707 ties section status to the ledger (RFC 0049)

**Status:** accepted

**Context.** The spec map claimed 18 conformance-covered kernel sections while the ledger rated 114 of 179 clauses `none`. The matcher compared raw header text byte for byte, so a header that dropped backticks or wrapped its quote did not match, and clause numbers were never read. Four sections had no clause list the ledger could read. Nothing checked a status against the rungs.

**Decision.**
- **Cites.** A conformance file cites a clause with a `// Spec: <id>` header block that quotes the clause. The block may wrap onto the following `//` lines. Backticks, quote style, spacing, case and the final period are ignored. A quoted prefix does not count, and clause numbers are not read. Any package's conformance file may cite any section.
- **One file per clause.** A clause is credited to a file only when that file's non-skipped tests assert all of it (tasks/0034-freeze D1). A clause whose parts live in different files is split into atomic bullets when its wording already separates them; otherwise it stays `none`.
- **Atomic lists.** Conformance is a bullet list. The inline paragraphs of k.reactive, k.store, k.schema and k.component are split with their wording unchanged.
- **E1707.** `keel ledger --diff` reports E1707 for each clause rated `none` in a `conformance-covered` or `frozen` section, and for such a section with no clause list. The status claim cannot outrun the evidence.
- **Statuses.** k.cli, k.check, k.schema, k.ctx and k.store go back to `implemented` until their missing assertions land (RFC 0049 table).

**Alternatives.**
- **Clause numbers.** They drift when a clause is inserted, so evidence moves to the wrong clause without any error.
- **Unquoted containment.** A long clause's header also credits every shorter clause that is its prefix.
- **Partial cites from several files.** The ledger cannot check that the parts add up to the clause.
- **Gate in `keel check`.** `keel check` does not read tests. The ledger diff already gates rungs (E1706).

**Consequences.**
- **Visible gaps.** Every uncited clause of a covered section fails CI's `pnpm ledger --diff`.
- **Restoring a status.** It takes the missing assertion plus a cite.
- **Spec edits.** Rewording a clause un-cites its tests until the headers follow, and E1707 points at it.
- **Check package follow-up.** `packages/check` still needs an `E1707` explain entry and an `EXPLAIN_ONLY` listing.
