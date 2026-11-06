---
"@keel/cli": minor
---

k.cli: one engine `run(argv, io)` over a schema-defined command table (`operations`), served by the `keel` binary, `keel mcp` (one tool per operation, JSON Schema input) and `keel lsp` (check diagnostics, fix diffs as code actions, explain on hover). Formatter registry `formatter(kind, { schema, compact, pretty })` with kernel kinds diag, summary, req, ledger, a11y (E1053, E1054). Usage errors E1051/E1052 exit 2. `check`, `spec`, `explain`, `ledger` (exports and spec clauses, rungs via `@keel/testing`), `test` (vitest with `KEEL_TEST=1`), `build` (`@keel/compiler` artifacts, then Vite), `scaffold`/`codemod` (`@keel/scaffold`, `--dry-run` diffs); dev, inspect, render report I1055.
