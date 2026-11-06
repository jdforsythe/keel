# @keel/cli

**Spec:** k.cli · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `run(argv, io: { cwd, files?, stdin?, env?, tty? })` -> `Promise<{ code, stdout, stderr }>`, the pure in-process engine (no fs, no process). `operations`: the command table, each `{ name, description, input, output, positional }`. `formatter(kind, { schema, compact, pretty })`. `mcp(provide)` / `lsp(provide)` -> `StdioServer { receive(chunk), done() }`. Binary `keel` (`dist/src/bin.js`) reads the project into `io.files`; `keel mcp` / `keel lsp` serve stdio; `keel test` delegates to vitest (`KEEL_TEST=1`).
- **Invariants:** argv and MCP arguments are validated by the same input schema; any unknown flag or invalid value is E1052, unknown command (and `session`) E1051, exit 2. Exit 1 iff an E diagnostic; W/I never fail. Default format compact when `!tty` or `KEEL_AGENT=1`, else pretty. Compact caps 5 per code (`--limit N`, uncapped with `--verbose`), `... +K more CODE (keel <cmd> --code CODE)`; `--quiet` prints the trailer only; `--code` filters display, the summary counts all. json = each record encoded by its schema, summary last. No timing in output: equal input, byte-identical output. Commands without their package (build, dev, inspect, render, scaffold, codemod; spec without `spec/`) report I1055, exit 0.
- **Dependencies:** `@keel/schema`, `@keel/check` (`check`, `explain`), `@keel/compiler`.
- **Rungs:** conformance (example + probabilistic); properties (argv round-trip per operation, render limit/quiet/determinism, surface parity cli = MCP = LSP), seed 1337.

## Extension points

`formatter(kind, def)`: one formatter per record kind; a second registration (kernel kinds `diag`, `summary`, `req`, `ledger`, `a11y` included) throws E1053. A record whose kind has no formatter, or that does not fit its schema, renders as E1054.

## Unsafe

count: 0
