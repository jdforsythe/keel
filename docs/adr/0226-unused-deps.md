# ADR-0226: k.module: a `deps` entry the module does not use is E1165 (RFC 0204)

**Status:** accepted (orchestrator, 2026-11-23, for the operator to confirm).

**Context.** `keel check` reports a missing `deps` entry (E1152) and not a surplus one, and E1153 builds its graph from every entry. In the household three entries no file imported closed a cycle the moment a fourth, needed one was added. `keel codemod move` adds the entries a move needs and removes none.

**Decision.**
- E1165, an error at the entry with a fix that removes it: a `deps` entry, other than a `@keel/std-*` package, that the module does not use, a module id the project lacks among them.
- A module uses an app module its `deps` list exactly when E1152 would ask for the entry: a non-test file of it, generated ones among them, imports from that module (static, type-only, re-exporting or literal dynamic, the contract's among them), or a binding of either module names a layout of the other.
- Stdlib entries are not judged: their rules, `std` config, routes and compose variables key on the entry with no import.
- E1153 is unchanged; a cycle through unused entries also reports one E1165 per entry.
- `keel codemod move` removes each entry a module used before the move and does not use after it; `@keel/scaffold`'s check proxy reads E1165.

**Alternatives.**
- A warning: it never fails a run, so the entries pile up as they did; E1154, the same surplus on `public.exports`, is an error.
- Judging stdlib entries by import, counting test imports as uses, or drawing E1153 from imports instead of `deps`: each needs exceptions or a second notion of edge.
- Reusing retired E1157, or k.library's E1161 to E1164.

**Consequences.** `apps/household`'s `receipts` drops `setup`. An author who lists a dep before the import sees E1165 until the import exists, as with E1154. Removing an entry can change a generated CI workflow (E1005 until `keel build`), as adding one does. k.module reads `implemented` until its five new clauses are covered.
