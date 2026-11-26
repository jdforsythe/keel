# k.cli: CLI, MCP, LSP
status: implemented
**One engine.** `@keel/cli` defines each command once as an operation `{ name, input: Schema, output: Schema }`, served by the `keel` binary (flags parsed by `input`), `keel mcp` (one MCP tool per operation) and `keel lsp` (check diagnostics, fix diffs as code actions, `explain` as hover).

**Commands.**
| command | does |
| --- | --- |
| `check [paths]` | k.check over code files and `.keel/*.json` artifacts under `paths`, each with its project's `topology.ts` |
| `test [paths]` | harness under sim ctx |
| `build` | production build per deployable |
| `dev [--port N]` | dev server and log stream (default Vite's `server.port` or 5173; in use: E1560) |
| `docs [id]` / `--for <code>` / `--sync` | installed docs (k.docs) |
| `explain <code>` | <= 120 tokens: meaning and fix pattern |
| `inspect [url]` | summarize a dev app's inspect document |
| `render <routeId\|Component> [--props json]` | a11y tree of one render |
| `scaffold <op>` / `codemod <op>` | structural operations (k.scaffold) |
| `ledger` | emit and diff the ledger |
| `evidence [--verify dir --key id]` | signed evidence bundle (k.evidence) |
| `review [range \| --all]` | escapes by danger and novelty (k.review) |
| `tokens import <files>` / `tokens set <path> <value>` | design tokens into `tokens.design.ts`; one value into `tokens.ts` (Tokens) |

`session` runs the operation std.sessions registers with `stdCommand('session', op)` after importing the project's std `deps`; unfilled, I1055. `report`: std.report.

Every command takes `--format=compact|json|pretty`, `--quiet`, `--limit N`, `--verbose`; diagnostic commands also `--code <code>`.

**Inspect.** In dev, `GET /__keel/inspect` is JSON `{ live, graph, stores, ids, a11y, routes, sections }`: `inspect()` outside a request scope, `{ [id]: { state, log } }` from `stores()` unredacted, the `.keel/` artifacts. A node deployable's `createApp` with `mode: 'dev'` serves it, else the compiler plugin's dev and preview servers, where the page's dev entry posts `{ graph, stores, sections, deployable }` on mount and change (`live: false` before). `keel dev` adds `deployables` (k.topology). Both answer a loopback or listed `Host` with its own or a listed `Origin` (`createApp({ inspect: { origins } })`; plugin: comma-separated `KEEL_INSPECT_ORIGINS`; `:*` any port; CORS echoed), no `Origin` for GET only; else 403 `keel.denied`. `keel inspect [url]` (default `http://localhost:5173`) prints an `inspect.store` per store, an `inspect.section` per section (per deployable given `deployables`) and counts.

**Inspector hooks** (extension point).
```ts
import { inspector } from '@keel/compiler/inspect/inspector'
inspector({ id: 'orders.recent', schema: Recent, read: (ctx) => recent(ctx) })
```
Per request each `read` gets the app's `ctx`; `sections[id]` is `{ doc, value }` (`schema.doc()`, the encoded value), or `{ doc, error }` when `read` throws or its value fails `schema` (E1057, logged).

**Tokens.** `keel tokens import <file>...` reads files in the Design Tokens Community Group format (groups of tokens holding `$value`, a `$type` on the token or a group above it, `{a.b}` aliases) and writes `tokens.design.ts` whole: the line `// Written by keel tokens import; edit tokens.ts.`, then `export const designTokens = defineTokens({...})` with its import. A file `<stem>.<mode>.tokens.json` is mode `<mode>` of collection `<stem>`; other files have no mode. Modes `light` and `dark` give pairs. In a collection's other modes, the first given holds the top-level values and each further one is a theme named in lowerCamel, `when` `print` for `print`, `contrast` for `contrast` and `highContrast`, else `choice`, holding each value that differs from the top level in its scheme. Types: `color` to `color`, sRGB as its `hex` or `#rrggbb`, `hsl`, `oklab`, `oklch` and `display-p3` in k.values forms, other spaces as `oklch()` at 4 decimals (W1072); `dimension` by its path's first segment, `space` or `spacing` to `space`, `size` or `sizing` to `size`, `radius` or `borderRadius` to `radius`, `fontSize` to `fontSize`, `breakpoint` to `breakpoint`; `fontFamily` to `font`, a family with a space in `"`; `fontWeight` to `weight` (the format's names as numbers); `duration` to `motion`; `shadow`; `border`; `typography` to a `look` of `font`, `fontSize` and `weight`, each the aliased token, else a token of the look's name. Skipped with W1072: `gradient`, `number`, `cubicBezier`, `transition`, a lone `strokeStyle`, a color with alpha outside a `shadow`, any other `dimension`, a name met before, a dangling or circular alias; dropped with W1072: `lineHeight`, `letterSpacing`. A name joins its path's segments in lowerCamel, less a first segment naming its group (`color`, `colors`, `type`, `typography` or a word above). An alias takes its target's value, written `<ref>` in `border` and `shadow`. When `tokens.ts` does not import `designTokens`, the import adds it and `...designTokens.<group>` in each group and `...designTokens.themes` in `themes`, as k.looks Fix does; with no `tokens.ts`, it writes `export const tokens = designTokens;`. It prints each W1072 at its `$value`, then `ok tokens import <n> tokens, <m> looks, <k> themes`; a file that is not JSON or holds no `$value` is E1071, and nothing is written.

`keel tokens set <path> <value>` sets one value in `tokens.ts`'s `tokens` literal, `<path>` `<group>/<name>`, `<group>/<name>/<scheme>`, or either after `themes/<theme>/`: it replaces the key written after the literal's last spread in that group (and theme), else adds it there, creating the group or theme as k.looks Fix does; with `<scheme>`, a value that was one string becomes a pair keeping it in the other scheme. It keeps every other property and comment, and writes nothing, as E1071, when the path has another form or the tokens would fail `TokenSchema`.

**Output.** Exactly OUTPUT.md. Exit codes: 0 no error diagnostics, 1 error diagnostics, 2 usage error.

**Formatter registry** (extension point).
```ts
import { formatter } from '@keel/cli'
formatter('orders.report', { schema: Report, compact: (r) => `${r.id} ${r.total}`, pretty: (r) => table(r) })
```
Every output record has a `kind`; each kind has exactly one formatter. `json` is never hand-formatted: the record encoded by its schema, one NDJSON line. Kernel kinds: `diag`, `summary`, `req`, `a11y`, `csp`, `evidence`, `review`, and k.ledger's. `@keel/cli/testing` exports `respond(records, { format? })`: renders records as a command does (E1054 included).

**Rules.** E1071 `keel tokens` refused (`<file> is not a design tokens file`, `<path> is not a token path`, `<path>: <value> fails TokenSchema`; fix: none) · W1072 a design token skipped or a field dropped (`<token>: <what> has no Keel group; skipped`, `<token> <field>: dropped`, `<token>: <space> as oklch`; fix: none) · I1055 command not available in this build (info) · E1051 unknown command · E1052 unknown flag, or flag value invalid for the input schema · E1053 formatter kind, std command or shell target registered twice · E1054 record emitted with a kind that has no formatter · E1056 inspect target unreachable, not 2xx, or not an inspect document · E1057 inspector id registered twice (throws), or a section that throws or fails its schema.

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
- With `design/color.light.tokens.json` `{"color":{"$type":"color","text":{"$value":"#1a191e"},"surface":{"$value":"#F9F9F9"}},"space":{"$type":"dimension","2":{"$value":{"value":8,"unit":"px"}}}}` and `design/color.dark.tokens.json` the same with `text` `#F3F3F3`, `keel tokens import design/color.light.tokens.json design/color.dark.tokens.json` writes `tokens.design.ts` whose `designTokens` deep-equals `{ color: { text: { light: '#1a191e', dark: '#F3F3F3' }, surface: '#F9F9F9' }, space: { 2: '8px' } }` and prints `ok tokens import 3 tokens, 0 looks, 0 themes`.
- Adding `design/brand.base.tokens.json` `{"color":{"$type":"color","accent":{"$value":"#b8420d"}}}`, `design/brand.slate.tokens.json` with `accent` `#0B5CAD` and `design/brand.highContrast.tokens.json` with `accent` `#8B300A`, in that order, gives `color.accent` `'#b8420d'` and `themes` `{ slate: { color: { accent: '#0B5CAD' } }, highContrast: { when: 'contrast', color: { accent: '#8B300A' } } }`.
- A token `hero` of `$type` `gradient` is one W1072 at its `$value` with message `hero: gradient has no Keel group; skipped`; a `typography` token `type.heading` `{"fontFamily":"Inter","fontSize":"28px","fontWeight":600,"lineHeight":1.2}` gives `font.heading` `'Inter'`, `fontSize.heading` `'28px'`, `weight.heading` `'600'`, `look.heading` `{ font: 'heading', fontSize: 'heading', weight: 'heading' }` and one W1072 `type.heading lineHeight: dropped`; a file `{"a":1}` is one E1071 and writes no file.
- With `tokens.ts` `export const tokens = brandTokens;` and its import, the first case's import makes `tokens` `defineTokens({ ...brandTokens, color: { ...brandTokens.color, ...designTokens.color }, space: { ...brandTokens.space, ...designTokens.space } })` with `defineTokens` and `designTokens` imported, `keel check` then reports none of E1807 and E1801, and a second import leaves `tokens.ts` byte for byte as it was.
- On that `tokens.ts`, `keel tokens set color/accent/dark '#8AB8F0'` adds `accent: { light: '#b8420d', dark: '#8AB8F0' }` after `...designTokens.color`, `keel tokens set themes/slate/radius/none 4px` adds `themes: { slate: { radius: { none: '4px' } } }`, a comment in the file stays, and `keel tokens set color/accent red` is one E1071 with message `color/accent: red fails TokenSchema` and writes nothing.
