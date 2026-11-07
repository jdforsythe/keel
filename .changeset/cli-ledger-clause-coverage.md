---
"@keel/cli": minor
---

k.testing Ledger (rfc:0049): a `// Spec: <id>, clause "<text>"` header is matched per header block, may wrap onto the next `//` lines, and is compared with backticks, quote style, spacing, case and the final period ignored; any package's conformance file may cite any section. Clause numbers and unquoted text are not read. `keel ledger --diff` reports E1707 for each clause of a `conformance-covered` or `frozen` section rated `none`, and for such a section with no clause list; its trailer counts them as `uncovered`.
