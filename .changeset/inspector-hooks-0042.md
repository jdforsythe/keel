---
"@keel/compiler": minor
"@keel/server": minor
"@keel/cli": minor
"@keel/check": patch
---

Inspector hooks (RFC 0042). `@keel/compiler/inspect/inspector` exports `inspector({ id, schema, read })`: a named, schema-typed section of the inspect document, read with the app's `ctx` per request into `sections[id]` as `{ doc, value }`, or `{ doc, error }` with E1057 (also on the dev log); a duplicate id throws E1057. A dev `createApp` answers inspect before creating its request scope, so `graph` no longer contains it. `keel inspect` and MCP `inspect` print `inspect.section` records and E1057; `@keel/cli/testing` exports `respond`. `keel explain E1057`.
