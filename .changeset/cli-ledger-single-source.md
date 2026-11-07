---
"@keel/cli": minor
---

k.testing Ledger: `keel ledger` is the only ledger (tooling/ledger.mjs removed). Evidence is AST-based: an import or a call by name inside a non-skipped `it`/`test` body (or a helper it calls), never a comment, string, or skipped test; property runs and seeds resolve through constants. Items include `apps/<app>/modules` exports. `--write <file>` writes the ledger file (with per-package `mutationScore` and spec clauses); `--diff` also reports a raised unsafe count (E1706); `--scope <prefix>` limits items. A `// Clause:` conformance header is W1706 (use `// Spec:`).
