# k.cli: CLI, MCP, LSP
status: conformance-covered
**One engine.** `@keel/cli` defines each command once as an operation `{ name, input: Schema, output: Schema }`, served by the `keel` binary (flags parsed by `input`), `keel mcp` (one MCP tool per operation) and `keel lsp` (check diagnostics, fix diffs as code actions, `explain` as hover).

**Commands.**
| command | does |
| --- | --- |
| `check [paths]` | k.check of code files and `.keel/*.json` artifacts under `paths`, each with its project's topology |
| `test [paths] [--e2e]` | harness, sim ctx; `--e2e` the built app (k.e2e) |
| `build` | production build per deployable |
| `dev [--port N] [--host A]` | dev server, log stream (Vite's `server.port` or 5173; in use: E1560); loopback unless `--host` (k.topology) |
| `docs [id]` / `--for <code>` / `--sync` | installed docs (k.docs) |
| `explain <code>` | <= 120 tokens: meaning and fix pattern |
| `inspect [url]` | summarize a dev app's inspect document |
| `render <routeId\|Component> [--props json]` | a11y tree of one render |
| `scaffold <op>` / `codemod <op>` | structural edits (k.scaffold) |
| `ledger` | emit, diff the ledger |
| `evidence [--verify dir --key id]` | signed evidence (k.evidence) |
| `review [range \| --all]` | escapes by danger, novelty (k.review) |

`session` runs the operation std.sessions registers with `stdCommand('session', op)` after importing the project's std `deps` (unfilled: I1055). `report`: std.report.

Every command takes `--format=compact|json|pretty`, `--quiet`, `--limit N`, `--verbose`; diagnostic ones also `--code <code>`.

**Inspect.** In dev, `GET /__keel/inspect` is JSON `{ live, graph, stores, ids, a11y, routes, sections }`: `inspect()` outside a request scope, `{ [id]: { state, log } }` from `stores()` unredacted, the `.keel/` artifacts. A `node` deployable's dev `createApp` serves it, else the compiler plugin's dev and preview servers, where the page's dev entry posts `{ graph, stores, sections, deployable }` on mount and change (`live: false` before). `keel dev` adds `deployables` (k.topology). Both answer a loopback or listed `Host` with its own or a listed `Origin` (`createApp({ inspect: { origins } })`; plugin: comma-separated `KEEL_INSPECT_ORIGINS`; `:*` any port; CORS echoed), no `Origin` for GET alone, else 403 `keel.denied`. `keel inspect [url]` (default `http://localhost:5173`) prints `inspect.store` per store, `inspect.section` per section (per deployable with `deployables`), counts.

**Inspector hooks** (extension point).
```ts
import { inspector } from '@keel/compiler/inspect/inspector'
inspector({ id: 'orders.recent', schema: Recent, read: (ctx) => recent(ctx) })
```
Per request each `read` gets the app's `ctx`; `sections[id]` is `{ doc, value }` (`schema.doc()`, the encoded value), or `{ doc, error }` when `read` throws or its value fails `schema` (E1057, logged).

**Output.** Exactly OUTPUT.md. Exit codes: 0 no error diagnostics, 1 error diagnostics, 2 usage error.

**Formatter registry** (extension point).
```ts
import { formatter } from '@keel/cli'
formatter('orders.report', { schema: Report, compact: (r) => `${r.id} ${r.total}`, pretty: (r) => table(r) })
```
Every output record has a `kind`, each kind one formatter. `json` is the record encoded by its schema, one NDJSON line, never hand-formatted. Kernel kinds: `diag`, `summary`, `req`, `a11y`, `csp`, `evidence`, `review`, k.ledger's. `@keel/cli/testing`'s `respond(records, { format? })` renders records as a command does (E1054 included).

**Rules.** I1055 command not available in this build (info) · E1051 unknown command · E1052 unknown flag, or flag value invalid for the input schema · E1053 formatter kind, std command or shell target registered twice · E1054 record emitted with a kind that has no formatter · E1056 inspect target unreachable, not 2xx, or not an inspect document · E1057 inspector id registered twice (throws), or a section that throws or fails its schema.

**Conformance.**
- For a fixture project, `keel check --format=json`, the MCP `check` tool, and LSP diagnostics yield the same set of (code, path, line, col, message).
- Each MCP tool's input schema equals the JSON Schema of its operation's input.
- A clean `keel check` in compact prints exactly one line.
- `keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics.
- Compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths.
- In json every line parses, has `kind`, and the last line has `kind: "summary"`.
- With 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line; `--limit 2` prints 2.
- `keel nope` emits E1051 and exits 2.
- `keel docs k.cli` prints <= 1,500 tokens.
- `GET /__keel/inspect` on a dev `createApp` returns every live store's state and log and the `inspect()` graph; in production mode it is the route table's 404.
- `keel dev --port <p>`, or `server.port: <p>` in the Vite config, serves on `p`; with `p` in use it prints one E1560 line and exits 1.
- An MCP `build` writes the `.keel/` files `keel build` writes.
- `keel inspect` against an unreachable url emits E1056 and exits 1.
- A `POST /__keel/inspect` without `Origin` on a dev `createApp` gets 403 `keel.denied`.
- A dev `createApp` serves each section as `{ doc, value }`; a value failing its schema is `{ doc, error }` with E1057; a second `inspector` with that id throws E1057.
- The served `graph` equals `inspect()` taken outside the request.
- `keel inspect` prints one `inspect.section` per section; an `error` one is E1057, exit 1.
- `respond` of a record of a kind with no formatter yields E1054.
- After `stdCommand('session', op)`, `keel session` parses argv with `op.input`, runs `op` and emits its records, and the MCP tools include `session`; unfilled, I1055, exit 0; filling it with another `op` throws E1053.
- `keel inspect` of a document with `deployables` prints one `inspect.section` per deployable and section.
