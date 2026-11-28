---
"@keel/cli": patch
---

Ledger evidence: `explore`, `simulate` and `properties` count only when imported from `@keel/testing`, never inside a call expected to throw or reject (`expect(() => ...)`, `.rejects`, a helper or matcher named like `toThrow`) or in statically dead code (`if (false)`, after `return` or `throw`); a computed key or a spread argument counts as options given. `--diff` reports E1713 for a package whose every mutation claim is stale. `monitored` evidence reads string literals from the syntax tree and a prefix of at least two segments.
