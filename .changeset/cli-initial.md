---
"@keel/cli": minor
---

k.cli: one engine `run(argv, io)` over a schema-defined command table (`operations`), served by the `keel` binary, `keel mcp` (one tool per operation, JSON Schema input) and `keel lsp` (check diagnostics, explain on hover). Formatter registry `formatter(kind, { schema, compact, pretty })` with kernel kinds diag, summary, req, ledger, a11y (E1053, E1054). Usage errors E1051/E1052 exit 2. `check`, `spec`, `explain`, `ledger` implemented; `test` delegates to vitest in the binary; build, dev, inspect, render, scaffold, codemod report I1055 until their packages land.
