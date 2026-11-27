# k.cli: CLI, MCP, LSP
status: conformance-covered
**One engine.** `@keel/cli` defines each command once as an operation `{ name, input: Schema, output: Schema }`, served by the `keel` binary (flags parsed by `input`), `keel mcp` (one tool per operation) and `keel lsp` (diagnostics, fixes as code actions, `explain` as hover).

**Commands.**
| command | does |
| --- | --- |
| `check [paths]` | k.check of code files and `.keel/*.json` artifacts under `paths`, each with its project's topology |
| `test [paths] [--e2e]` | harness, sim ctx; `--e2e` the built app (k.e2e) |
| `build` | production build per deployable |
| `dev [--port N] [--host A]` | dev server, log stream (Vite's `server.port` or 5173; in use: E1560); loopback unless `--host` (k.topology) |
| `docs [id]` / `--for <code>` / `--sync` | installed docs (k.docs) |
| `explain <code>` | <= 120 tokens: meaning and fix pattern |
| `inspect [url]` | summarize a dev app's inspect document (k.inspect) |
| `render <routeId\|Component> [--props json]` | a11y tree of one render |
| `scaffold <op>` / `codemod <op>` | structural edits (k.scaffold) |
| `ledger` | emit, diff the ledger |
| `evidence [--verify dir --key id]` | signed evidence (k.evidence) |
| `review [range \| --all]` | escapes by danger, novelty (k.review) |

`session` runs the operation std.sessions registers with `stdCommand('session', op)` after importing the project's std `deps` (unfilled: I1055). `report`: std.report; `tokens`: k.design-tokens.

Every command takes `--format=compact|json|pretty`, `--quiet`, `--limit N`, `--verbose`; diagnostic ones also `--code <code>`.

**Output.** Exactly OUTPUT.md. Exit: 0 no error diagnostics, 1 error diagnostics, 2 usage error.

**Formatter registry.**
```ts
import { formatter } from '@keel/cli'
formatter('orders.report', { schema: Report, compact: (r) => r.id, pretty: table })
```
Every output record has a `kind`, each kind one formatter. `json` is the record encoded by its schema, one NDJSON line, never hand-formatted. Kernel kinds: `diag`, `summary`, `req`, `a11y`, `csp`, `evidence`, `review`, k.ledger's. `@keel/cli/testing`'s `respond(records, { format? })` renders records as a command does (E1054 included).

**Rules.** I1055 command not available in this build (info) · E1051 unknown command · E1052 unknown flag, flag value invalid for the input schema, or a required input missing, named as typed (`--to <module>`) with a line passing it · E1053 formatter kind, std command or shell target registered twice · E1054 record emitted with a kind that has no formatter.

**Command form.** A line `keel` prints names each `keel <command>` in the form the reader runs it from: when `npm_config_user_agent` names pnpm, npm, yarn or bun, that manager's (`pnpm keel build`, `npx --no keel build`, `yarn keel build`, `bun run keel build`), since a `keel` on PATH may be another program; with none, `keel build`. A `keel` already in a manager's form is left as it is. Compact and pretty only; json keeps each record's text.

**Conformance.**
- `keel codemod move OrderCard` is E1052 naming `--to <module>` and a line passing it.
- Under pnpm, `pnpm keel docs` in a line is printed as it is.
- For a fixture project, `keel check --format=json`, the MCP `check` tool, and LSP diagnostics yield the same set of (code, path, line, col, message).
- Each MCP tool's input schema is its operation's input's JSON Schema without `format`, `quiet`, `limit` and `verbose`, which `initialize` states once; each tool takes them, a refused value E1052.
- A clean `keel check` in compact prints exactly one line.
- `keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics.
- Compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths.
- In json every line parses, has `kind`, and the last line has `kind: "summary"`.
- With 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line; `--limit 2` prints 2.
- `keel nope` emits E1051 and exits 2.
- `keel docs k.cli` prints <= 1,500 tokens.
- `keel dev --port <p>`, or `server.port: <p>` in the Vite config, serves on `p`; with `p` in use it prints one E1560 line and exits 1.
- An MCP `build` writes the `.keel/` files `keel build` writes.
- `respond` of a record of a kind with no formatter yields E1054.
- After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053.
- Run with `npm_config_user_agent` `pnpm/10.0.0`, `keel check` in a project with a stale generated deploy file prints its E1005 line naming `pnpm keel build`; with `npm/10.0.0`, `npx --no keel build`; with none, `keel build`; with `--format=json` the record text is the same in each.
- `keel dev` with no `server.host` in the Vite config, or with `server.host` `127.0.0.1`, listens on 127.0.0.1 only.
