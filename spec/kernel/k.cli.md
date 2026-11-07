# k.cli: CLI, MCP, LSP
status: conformance-covered

**One engine.** `@keel/cli` defines each command once as an operation `{ name, input: Schema, output: Schema }`. Three surfaces serve the same engine: the `keel` binary (flags parsed by the input schema), `keel mcp` (one MCP tool per operation; input schema as JSON Schema), and `keel lsp` (check diagnostics as LSP diagnostics, fix diffs as code actions, `explain` as hover). Same input, same diagnostics on every surface.

**Commands.**
| command | does |
| --- | --- |
| `check [paths]` | k.check over the code files and `.keel/*.json` artifacts under `paths`, each with its project's `topology.ts` |
| `test [paths]` | harness under sim ctx (k.testing) |
| `build` | production build per deployable (k.server) |
| `dev` | dev server and log stream (k.server) |
| `spec <id>` / `--for <code>` / `--map` | one section, sections citing a code, or the map |
| `explain <code>` | <= 120 tokens: meaning and fix pattern |
| `inspect [url]` | summarize a running dev app's inspect document (principle 6) |
| `render <routeId\|Component> [--props json]` | a11y tree of one render |
| `scaffold <op>` / `codemod <op>` | structural operations (k.scaffold) |
| `ledger` | emit and diff the ledger (k.testing) |

`session` is reserved for the stdlib sessions module; without it the kernel reports I1055 (info, exit 0).

Every command accepts `--format=compact|json|pretty`, `--quiet`, `--limit N`, `--verbose`; diagnostic-emitting commands also accept `--code <code>`.

**Inspect.** In dev, a running app serves `GET /__keel/inspect` as JSON `{ live, graph, stores, ids, a11y, routes, sections }`: `graph` is `inspect()` (k.reactive) outside any request scope, `stores` is `{ [id]: { state, log } }` from `stores()` (k.store), and `ids`, `a11y`, `routes` are the `.keel/` artifacts. Node deployables serve it from `createApp` with `mode: 'dev'` (`artifacts` names the `.keel` directory); client-only apps from the compiler plugin's dev and preview servers, where the live half comes from the open page: its dev entry posts `{ graph, stores, sections }` after mount and whenever it changes (`live: false` until a page has posted). Both answer only a loopback or listed `Host` whose `Origin` is the server's own or listed (`createApp({ inspect: { origins } })`; for the plugin, comma-separated `KEEL_INSPECT_ORIGINS`; `:*` any port), echoing a listed cross-origin `Origin` for CORS; an absent `Origin` is admitted for GET only; others get 403 `keel.denied`. `keel inspect [url]` (default `http://localhost:5173`) fetches it and prints one `inspect.store` record per store, one `inspect.section` per section, and a summary with node, edge, store, id, a11y, route, and section counts. The viewer is the Keel app `apps/inspector`.

**Inspector hooks** (extension point, RFC 0042).
```ts
import { inspector } from '@keel/compiler/inspect/inspector'
inspector({ id: 'orders.recent', schema: Recent, read: (ctx) => recent(ctx) })
```
Per request each `read` gets the app's `ctx`; `sections[id]` is `{ doc, value }` (`schema.doc()`, the encoded value), or `{ doc, error }` when `read` throws or its value fails `schema` (E1057, also on the dev log). A client-only app's entry posts them. The viewer renders each from `doc` and `value`.

**Output.** Exactly OUTPUT.md: one data model, three renderings. Default `compact` when stdout is not a TTY or `KEEL_AGENT=1`, else `pretty`. Exit codes: 0 no error diagnostics, 1 error diagnostics, 2 usage error.

**Formatter registry** (extension point).
```ts
import { formatter } from '@keel/cli'
formatter('orders.report', { schema: Report, compact: (r) => `${r.id} ${r.total}`, pretty: (r) => table(r) })
```
Every output record has a `kind`; each kind has exactly one formatter. `json` is never hand-formatted: it is the record encoded by its schema as one NDJSON line. Kernel kinds: `diag`, `summary`, `req`, `ledger`, `a11y`. `@keel/cli/testing` exports `respond(records, { format? })`: renders records as a command does (E1054 included).

**Rules.** I1055 command not available in this build (info; exit 0; e.g. `scaffold` without `@keel/scaffold`) · E1051 unknown command · E1052 unknown flag, or flag value invalid for the input schema · E1053 formatter kind registered twice · E1054 record emitted with a kind that has no formatter · E1056 inspect target unreachable, not 2xx, or not an inspect document · E1057 inspector id registered twice (throws), or a section that throws or fails its schema.

**Conformance.**
- For a fixture project, `keel check --format=json`, the MCP `check` tool, and LSP diagnostics yield the same set of (code, path, line, col, message).
- Each MCP tool's input schema equals the JSON Schema of its operation's input.
- A clean `keel check` in compact prints exactly one line.
- `keel check apps/a` at a workspace root and `keel check` in `apps/a` report the same diagnostics.
- Compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths.
- In json every line parses, has `kind`, and the last line has `kind: "summary"`.
- With 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line; `--limit 2` prints 2.
- `keel nope` emits E1051 and exits 2.
- `keel spec k.cli` prints <= 1,500 tokens.
- `GET /__keel/inspect` on a dev `createApp` returns every live store's state and log and the `inspect()` graph; in production mode it is the route table's 404.
- `keel inspect` against an unreachable url emits E1056 and exits 1.
- A `POST /__keel/inspect` without `Origin` on a dev `createApp` gets 403 `keel.denied`.
- A dev `createApp` serves each section as `{ doc, value }`; a value failing its schema is `{ doc, error }` with E1057; a second `inspector` with that id throws E1057.
- The served `graph` equals `inspect()` taken outside the request.
- `keel inspect` prints one `inspect.section` per section; an `error` one is E1057, exit 1.
- `respond` of a record of a kind with no formatter yields E1054.
