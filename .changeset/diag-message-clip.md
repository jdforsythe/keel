---
"@keel/cli": patch
"@keel/check": patch
"@keel/testing": patch
---

A diagnostic's message is clipped by one rule before it is rendered (k.check Diagnostics): whitespace runs holding a line feed become one space, at most 89 UTF-16 code units, a longer message keeps 86 (85 before the first half of a surrogate pair) and `...`. `respond` clips every `diag` record, so compact, pretty, json, MCP and LSP carry the same message; `keel test`'s T0001 follows the same rule.
