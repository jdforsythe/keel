# k.cli: CLI, MCP, LSP
status: proposed

**One engine.** `@keel/cli` defines each command once as an operation `{ name, input: Schema, output: Schema }`. Three surfaces serve the same engine: the `keel` binary (flags parsed by the input schema), `keel mcp` (one MCP tool per operation; input schema as JSON Schema), and `keel lsp` (check diagnostics as LSP diagnostics, fix diffs as code actions, `explain` as hover). Same input, same diagnostics on every surface.

**Commands.**
| command | does |
| --- | --- |
| `check [paths]` | k.check pipeline |
| `test [paths]` | harness under sim ctx (k.testing) |
| `build` | production build per deployable (k.server) |
| `dev` | dev server and log stream (k.server) |
| `spec <id>` / `--for <code>` / `--map` | one section, sections citing a code, or the map |
| `explain <code>` | <= 120 tokens: meaning and fix pattern |
| `inspect state\|deps\|tree\|a11y\|log [--id]` | query a running dev app (principle 6) |
| `render <routeId\|Component> [--props json]` | a11y tree of one render |
| `scaffold <op>` / `codemod <op>` | structural operations (k.scaffold) |
| `ledger` | emit and diff the ledger (k.testing) |

`session` is reserved for the stdlib sessions module; without it the kernel reports E1051.

Every command accepts `--format=compact|json|pretty`, `--quiet`, `--limit N`, `--verbose`; diagnostic-emitting commands also accept `--code <code>`.

**Output.** Exactly OUTPUT.md: one data model, three renderings. Default `compact` when stdout is not a TTY or `KEEL_AGENT=1`, else `pretty`. Exit codes: 0 no error diagnostics, 1 error diagnostics, 2 usage error.

**Formatter registry** (extension point).
```ts
import { formatter } from '@keel/cli'
formatter('orders.report', { schema: Report, compact: (r) => `${r.id} ${r.total}`, pretty: (r) => table(r) })
```
Every output record has a `kind`; each kind has exactly one formatter. `json` is never hand-formatted: it is the record encoded by its schema as one NDJSON line. Kernel kinds: `diag`, `summary`, `req`, `ledger`, `a11y`.

**Rules.** I1055 command not available in this build (info; exit 0; e.g. `session` before the stdlib module, `scaffold` without `@keel/scaffold`) · E1051 unknown command · E1052 unknown flag, or flag value invalid for the input schema · E1053 formatter kind registered twice · E1054 record emitted with a kind that has no formatter.

**Conformance.**
- For a fixture project, `keel check --format=json`, the MCP `check` tool, and LSP diagnostics yield the same set of (code, path, line, col, message).
- Each MCP tool's input schema equals the JSON Schema of its operation's input.
- A clean `keel check` in compact prints exactly one line.
- Compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths.
- In json every line parses, has `kind`, and the last line has `kind: "summary"`.
- With 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line; `--limit 2` prints 2.
- `keel nope` emits E1051 and exits 2.
- `keel spec k.cli` prints <= 1,500 tokens.
