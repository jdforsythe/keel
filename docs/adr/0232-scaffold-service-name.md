# ADR-0232: k.scaffold and k.openapi: `keel scaffold service --name` (RFC 0210)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** `keel scaffold service <module>` names the endpoint declaration after the module (`AppApi` in `examples/openapi-import`), while `openapi(doc, { name })` takes a name and the command offers no flag for it. A hand-written client such as `examples/client-only-api`'s names its declaration after the API it describes (`GitHubApi`).

**Decision.**
- `--name <name>` with `--openapi` or `--base`; the operation input gains `name?`, which the MCP tool already carries as a structural flag. The declaration is `<Name>Api` in `<Name>Api.schema.ts`.
- Without it, `name` is the module id: the default output is unchanged.
- A valid name is lowerCamel, the module id rule; anything else is E1352, nothing written, in both forms. `openapi` throws a `RangeError` outside the same rule.
- The client stays `api` in `api.server.ts`: one scaffolded service per module, a second E1351.
- No new code; `spec.section` and `docs.section` budgets re-based from 3,100 to 3,400 tokens.

**Alternatives.**
- `--name` as the whole export, or PascalCase accepted as given: a second meaning of `name`, or two spellings of one declaration.
- Naming the client after `name` too: changes every default output for a rare second service.
- The flag on `--openapi` only: the `--base` form writes the same declaration.

**Consequences.** `openapi` refuses `Orders`, `my_api` and `order-items`, which no caller passes. A module that calls a second third-party API writes that client by hand. k.openapi reads `implemented` until its two new clauses are covered.
