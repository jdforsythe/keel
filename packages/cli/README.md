# @keel/cli

**Spec:** k.cli · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** `run(argv, io: { cwd, files?, load?, apply?, stdin?, emit?, env?, tty?, fetch? })` -> `Promise<{ code, stdout, stderr }>`, the one engine for every surface (files given or loaded per operation scope; effects of a successful run to `apply`; `test` runs vitest on `io.cwd` when there are tests). `operations` (`{ name, description, input, output, positional, scope }`). `formatter(kind, { schema, compact, pretty })`. `mcp(provide)` / `lsp(provide)` -> `StdioServer` (one throw answers -32603, never stops the server). Binary `keel` (`dist/src/bin.js`) calls `run` with a host `Io` (stdio streaming for `mcp`/`lsp`; writes confined to the cwd), then `vite build`/`vite` when `vite.config.ts` exists; `build` runs `vite build` per `viteTargets(topology.ts)`: the project's own (unless every deployable is `node`), then one per `node` deployable with `KEEL_DEPLOYABLE` (k.server Build, RFC 0048). RFC 0070: `stdCommand("session", op: StdOperation)` fills the reserved `session` command; `Io.fetch(url, init?)`.
- **Invariants:** argv and MCP arguments share one input schema: unknown flag or bad value E1052, unknown command E1051, exit 2. Exit 1 on an E diagnostic or failing summary. `check` (every surface) and `build` first import each `@keel/std-*` package in an app manifest's `deps` (`importDeps`; E1159), so stdlib rules and config schemas register; `build` also writes `.keel/std.json` (rfc:0066). Compact default when `!tty` or `KEEL_AGENT=1`. Cap 5 per code (`--limit`, `--verbose`), `--quiet` trailer only, `--code` filters display. No timing: equal input, equal bytes. scaffold/codemod (`@keel/scaffold`) and build (`@keel/compiler`, `.keel/` artifacts) return writes; `--dry-run` diffs equal the apply. `inspect [url]` fetches `<url>/__keel/inspect` via `io.fetch` (binary: global fetch; absent: I1055) and prints one `inspect.store` per store plus counts; unreachable, non-2xx or not a document: E1056. dev/render: I1055.
- **Dependencies:** `@keel/schema`, `@keel/check`, `@keel/compiler`, `@keel/scaffold`, `@keel/testing`, `vitest`.
- **Rungs:** conformance; properties (argv round-trip, render limit/quiet, diff/edit round-trip, cli = MCP = LSP), seed 1337.

## Extension points

`formatter(kind, def)`: one formatter per record kind; a second registration (kernel kinds `diag`, `summary`, `req`, `ledger`, `a11y` included) throws E1053. A record whose kind has no formatter, or that does not fit its schema, renders as E1054.

## Unsafe

count: 0
