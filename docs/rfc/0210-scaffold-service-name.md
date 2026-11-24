# RFC 0210: k.scaffold and k.openapi: `keel scaffold service --name`

Status: implemented (ADR-0232), accepted by the orchestrator on 2026-11-24, for the operator to confirm. Amends k.scaffold (Operations example, Generators, Service, Rules, Conformance), k.openapi (API, Conformance), the map, the section budget. From `examples/openapi-import` (examples finding 6, backlog 1013).

## Decisions
- D1: `keel scaffold service <module>` takes `--name <name>` with `--openapi` and with `--base`; the operation's input gains `name?`. The declaration is `<Name>Api` in `<Name>Api.schema.ts`, `<Name>` being `name` with its first letter upper-cased.
- D2: the default stays: without `--name`, `name` is the module id, so every existing output is byte-identical.
- D3: a valid `name` is lowerCamel, `/^[a-z][A-Za-z0-9]*$/`, the module id rule. Anything else is E1352, nothing written, in both forms. `openapi(doc, { name })` takes the same rule and throws a `RangeError` outside it, so no name passes one and fails the other.
- D4: the client stays `api` in `api.server.ts`. A module holds one scaffolded service; a second, under any name, is E1351 on `api.server.ts`.
- D5: no new code. E1352 (naming) gains the service name; E1351 (target exists) covers both file clashes.

## Problem
`keel scaffold service app --openapi openapi.json` in `examples/openapi-import` wrote `AppApi.schema.ts`, exporting `AppApi`: the declaration is named after the module that calls the API, not after the API. `openapi(doc, { name })` from `@keel/services/openapi` takes the name and the command passes the module id, with no flag to pass another. `examples/client-only-api`, written by hand, names its declaration `GitHubApi`, the name of the service it describes; the scaffold cannot write that.

What the tree does today:
- `opService` (`packages/scaffold/src/internal/opService.ts`) derives `name = pascal(id) + "Api"` and writes `modules/<id>/<name>.schema.ts` and `api.server.ts`; E1352 for an id that is not lowerCamel, E1351 for either file existing.
- `openapiInput` (`packages/cli/src/internal/openapiInput.ts`) calls `openapi(doc, { name: args[0] })` and reports a thrown `RangeError` as E1052 "is not a module id".
- `openapi` accepts a `name` with a leading letter whose `pascal` form plus `Api` is an identifier: `Orders`, `my_api` and `order-items` pass. `OpenApiOptions` documents `name` as the module id.
- `--name` is already a structural flag of `@keel/cli` (`operations.ts`, used by `scaffold shell`), so the MCP `scaffold` tool's input schema already has it.

## Proposal
### The flag and the input
```sh
keel scaffold service orders --openapi openapi.json --name gitHub
keel scaffold service orders --base https://api.github.com --name gitHub
```
Both write `modules/orders/GitHubApi.schema.ts` (`export const GitHubApi = ...`) and `modules/orders/api.server.ts` (`export const api = service({ base, schema: GitHubApi })`). The scaffold input is `{ id, name?, base?, schema?, service?, reason? }`; the CLI maps `--name` to `name` and, with `--openapi`, passes it to `openapi(doc, { name })` as well, so the generated texts and the file name agree. The MCP tool input is the CLI's flag set, which holds `name` already: one shape.

### A valid name
lowerCamel, letters and digits, a lower-case first letter: the module id rule, so the default is always valid. `GitHub`, `git_hub`, `git-hub`, `1x` and `''` are E1352. A PascalCase name is refused rather than taken as it is: one spelling per declaration, and `--name GitHub` and `--name gitHub` do not both work. The declaration `<Name>Api` is never a reserved word, and the generator already keeps a component const from taking it. A clash with an existing file is E1351, at `api.server.ts` where it exists, else `<Name>Api.schema.ts`. A clash a file name does not show (another file of the module exporting `GitHubApi`) is whatever `keel check` reports, and the Guarantee turns it into E1353.

With `--openapi`, a bad `--name` is E1352 as well, not the E1052 `openapiInput` reports for a document it cannot read: the CLI checks the name before it calls `openapi`.

### `--name` without `--openapi`
It applies. The `--base` form writes the same `<Name>Api.schema.ts`, and `examples/client-only-api`'s `GitHubApi` is that form's output; a flag of one form only would be a second rule to learn.

### The client
`api` in `api.server.ts`, as today. Renaming it with `name` (`gitHubApi.server.ts`) would let a module hold several scaffolded services, and would change the default output of every scaffolded service, the k.openapi `service` text, `examples/openapi-import` and seven scaffold conformance files. Not proposed; a module that needs a second third-party API writes its second client by hand, as `examples/client-only-api` does.

### `openapi(doc, { name })`
The API is unchanged; its `name` rule is stated and tightened to lowerCamel, the one rule the scaffold applies. `OpenApiOptions` says `name` is the service name, the module id under `keel scaffold service` by default.

## Alternatives
- **`--name` as the whole export (`--name GitHubApi`).** Then the file and the declaration could drop the `Api` suffix every scaffolded declaration has, and `openapi`'s `name` would mean something else from the flag. Rejected.
- **Accept PascalCase and keep it.** Two spellings for one declaration. Rejected.
- **Name the client too.** Above: a rewrite of the default for one rare case.
- **`--name` with `--openapi` only.** The `--base` form writes the same declaration.
- **A new code for a bad name.** E1352 is the naming refusal for every generator.

## Spec diff
Applied in this commit.
- k.scaffold (stays `implemented`): the Operations example uses `--name gitHub`; Generators reads `<Name>Api.schema.ts`; Service gains the `name` input, its rule, its default and the one-service consequence; `--openapi` generates for `name`; `--base` reads `<Name>Api`; Rules E1352 gains the service name; Conformance gains three clauses (#24 to #26).
- k.openapi (to `implemented` until its two new clauses are covered): API states the `name` rule and its `RangeError`; Conformance gains two clauses (#2, #3).
- Map: the k.openapi row reads `implemented`; the section budget reads 3,400.
- `tooling/budgets.json`: `spec.section` and `docs.section` re-based from 3,100 to 3,400 tokens (k.scaffold measures about 3,370 with this text); `docs/OUTPUT.md` states the new limits.
- No glossary term, no section, no code added.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/scaffold/conformance/service-name.test.ts`: k.scaffold#24 and #26 over file maps (`scaffold('service', ...)`, the `node` project of `service-base-support.ts`).
- `packages/scaffold/conformance/cli-service-flags.test.ts` (extended) or `cli-service-name.test.ts`: k.scaffold#25 through the real binary, as the file's `--openapi` cases run.
- `packages/services/conformance/openapi-name.test.ts`: k.openapi#2 and #3 over the committed OpenAPI fixture.
- Existing cases: none change; no input without `name` produces a different output. The tightened `openapi` rule refuses no name an existing test passes (`orders`, `x`).

## Migration
None. The default output is unchanged.

## Token impact
- Spec: k.scaffold grows by about 400 tokens; k.openapi by about 120. The map is unchanged in size.
- `@keel/scaffold`, `@keel/cli`, `@keel/services/openapi`: a field, a regex and a branch; size to measure in the build.

## Build plan
1. This commit: RFC, ADR, spec text, budget re-base. 2. `conformance-writer`: the five clauses. 3. Build:
- `packages/scaffold/src/internal/inputs.ts`: `service` gains `name: s.string().optional()`. `opService.ts`: `name ?? id`, E1352 when not lowerCamel (path `modules/<id>`, message naming the value), then `${pascal(name)}Api`.
- `packages/cli/src/internal/scaffoldInput.ts`: the `service` case passes `name: input.name`. `openapiInput.ts`: takes `input.name ?? args[0]`; a `--name` that is not lowerCamel skips generation, so the scaffold reports E1352.
- `packages/services/src/openapi/openapi.ts`: the lowerCamel test in place of the leading-letter and `IDENT` test; `OpenApiOptions.ts` doc comment.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1352's text names the service name.
- Docs: `packages/scaffold/README.md`, `packages/services/README.md`, the `keel-server` skill's OpenAPI import paragraph, `examples/openapi-import/README.md` (one sentence on `--name`), a changeset, `tasks/p1/examples-findings.md` (finding 6), `tasks/BACKLOG.md`.

## For the operator
1. **The client stays `api` in `api.server.ts`.** Recommended: yes; `--name` names the declaration, and one scaffolded service per module stays the shape.
2. **lowerCamel only, PascalCase refused.** Recommended: yes; one spelling per declaration, the module id rule.
3. **`openapi(doc, { name })` refuses `Orders`, `my_api` and `order-items`, which it took before.** Recommended: yes; no caller in the tree passes one.
4. **Section budget 3,100 to 3,400 tokens.** k.scaffold is the largest section; splitting Service into its own section would renumber clauses existing conformance headers cite.
