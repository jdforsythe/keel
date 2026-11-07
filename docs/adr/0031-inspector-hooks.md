# ADR-0031: Inspector hooks as a one-way registry of self-describing inspect sections (RFC 0042)

**Status:** accepted

**Context.** "Inspector hooks" was listed as an extension point, but it had no API, and the inspect document was a closed shape (freeze review §3, backlog 0063). There were two related defects. The served `graph` included the server's own request scope, and E1054 had no public trigger (backlog 0109).

**Decision.**
- **Registry.** `inspector({ id, schema, read })` from `@keel/compiler/inspect/inspector` registers a section. A duplicate `id` throws E1057. There is no lookup and no unregister, the same one-way form as `formatter` and `defineRule`.
- **Reading.** Each inspect request reads every section with the app's `ctx`. A valid value is served as `sections[id] = { doc: schema.doc(), value }`. A throwing `read` or a failing value is served as `{ doc, error }` and logged as E1057.
- **Graph.** A dev `createApp` answers inspect before it creates any request scope.
- **CLI surfaces.** `keel inspect` and MCP `inspect` emit one `inspect.section` record per section and E1057 per failed section. The viewer renders every section generically from `doc` and `value`.
- **Testing.** `@keel/cli/testing` exports `respond(records, { format? })`.

**Alternatives.**
- **A manifest `inspector` list.** It would put functions in a static manifest.
- **A registry in `@keel/cli` or `@keel/server`.** The cli is above the server in dependency order, and the server is node-only.
- **Sections without `doc`.** The viewer cannot see the schema.

**Consequences.**
- **Dependency.** `@keel/compiler` depends on `@keel/ctx` for the `read` signature.
- **Client-only apps.** The plugin's document carries no `sections` until the dev entry posts them with its live half. Readers treat an absent key as `{}`.
- **Failure output.** A section's failure is visible on both the dev log and `keel inspect` (exit 1).
- **Isolation.** A section's `read` runs outside any request scope, so signals it creates are not attached to one.
