# RFC 0042: Inspector hooks, a request-scope-free inspect graph, and `@keel/cli/testing`

Status: implemented (ADR-0031)

## Problem
GLOSSARY and ARCHITECTURE list "inspector hooks" as an extension point, but it has no spec text and no API, and the inspect document (k.cli Inspect) is a closed shape (docs/freeze-review.md §3, backlog 0063). A stdlib module cannot put its own runtime state in front of `keel inspect`, the MCP `inspect` tool, or the viewer. Two more gaps sit beside it (backlog 0109). First, a dev `createApp` creates the request's isolated scope before it chooses the inspect branch, so the served `graph` contains the server's own per-request scope. Second, E1054 is raised only inside the CLI's `normalize`, and no public surface can emit a record of an unregistered kind, so E1054 has no conformance test.

## Proposal
- **Registry.** `inspector({ id, schema, read })` comes from `@keel/compiler/inspect/inspector`. It follows the one-way form of `formatter(kind, def)` and `defineRule(def)`: it only registers, has no lookup or unregister, and a duplicate key throws a coded Error. A second `id` throws `E1057 inspector section <id> registered twice`. The registry lives in `@keel/compiler/inspect`, the browser-safe home that the plugin and the server already share for inspect, so that a later page-side reporter can use it.
- **Document.** The document becomes `{ live, graph, stores, ids, a11y, routes, sections }`. For each registered section, the request calls `read(ctx)` with the app's `ctx`, then parses the value with `schema`. A valid value becomes `sections[id] = { doc: schema.doc(), value: schema.encode(value) }`. A throwing `read` or a failing value becomes `{ doc, error: "E1057 inspector section <id> ..." }`, and the serving process also writes it as a `diag` on the dev log. The other sections are still read. `doc` makes each section self-describing, so the viewer and agents can render a section they have never seen.
- **Graph.** `createApp` decides inspect before it creates the request scope. It answers inspect (or the 403) without a scope, so `graph` holds the app's scopes alone.
- **`keel inspect` and MCP `inspect`.** Both use one engine. After the store records they print one `inspect.section` record `{ id, doc, value }` per value section, sorted by id. Each `error` section is printed as an E1057 diag and gives exit 1. The summary counts `sections`. Compact output clips the value's JSON at 120 characters; json output carries it whole.
- **Viewer.** `apps/inspector` adds `SectionsView`. For each section it shows the id, `Type: <doc>`, and either the value as JSON text or `Failed: <E1057>`.
- **`@keel/cli/testing`.** It exports `respond(records, { format? })`, which renders records exactly as a command does: normalize (E1054), exit code, and the non-TTY default format. It is the public way to test a stdlib formatter registration, and the E1054 test uses it.
- **E1057.** E1057 is the new code in block E105x (k.cli). Map line unchanged: `| E100x | k.compiler | E105x | k.cli |`.

## Alternatives
- **A module manifest `inspector` list.** The manifest is static data that `ModuleSchema` validates. A `read` function would make it executable, and k.module would need its own RFC. A registry matches the other runtime extension points.
- **Exporting the registry from `@keel/cli`.** The server must read it, and the server sits below the cli in `tooling/deps.json`.
- **Exporting the registry from `@keel/server`.** Server is node-only, so a page-side reporter for client-only apps could never use it.
- **`sections: { [id]: value }` without `doc`.** The viewer runs in another process and does not have the schema.
- **Dropping failing sections silently.** The failure would be invisible to `keel inspect`, so this was rejected.
- **Removing "inspector hooks" from GLOSSARY.** It keeps principle 6 (the runtime is queryable) closed to stdlib, and backlog 0092 (sessions taps) needs it.

## Spec diff
k.cli:
- **Inspect.** The document gains `sections`; `graph` is taken "outside any request scope"; `keel inspect` gains `inspect.section` records and a section count.
- **New "Inspector hooks" paragraph.** It covers the API, `{ doc, value }` and `{ doc, error }`, the dev log, and that the plugin's document has no sections (read as `{}`).
- **Formatter registry.** It now names `@keel/cli/testing` `respond`.
- **Rules.** E1057 is added.
- **Conformance.** Four bullets are appended, so existing clause numbers hold.

GLOSSARY and ARCHITECTURE name the API in the extension-point lists. The term itself is unchanged.

## Conformance diff
Added:
- cli `inspect-sections.test.ts`.
- server `inspect-sections.test.ts` and `inspect-graph-request-scope.test.ts`.

Edited:
- cli `rules-e1053-e1054.test.ts` gains an E1054 test through `respond`, and its "untestable" note is dropped.
- check `fixture-per-code.test.ts` lists E1057 as explain-only (it is a runtime code with no source fixture).

## Migration
None for apps. `inspectResponse` (server internal) now takes `ctx` and returns `{ response, diags }`. `@keel/compiler` now depends on `@keel/ctx`, which `tooling/deps.json` allows. The plugin's middleware and dev entry do not report sections yet: a client-only app's page would have to post `sections` with its live half (follow-up).

## Token impact
k.cli 1,191 -> 1,487 (budget 1,500). The `keel spec k.cli` output is about 1,494, within the 1,500 limit of the conformance bullet. MCP `tools/list` is unchanged, because the input schemas are unchanged.
