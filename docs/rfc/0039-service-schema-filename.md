# RFC 0039: Service schema filename equals its export; k.scaffold conformance-covered

Status: implemented (ADR-0028)

## Problem
Backlog 0108; rfc:0036 Remaining 2. k.services named the endpoint declaration file `modules/<m>/api.schema.ts` and exported `<M>Api` from it. `@keel/services/openapi` (rfc:0034) generated that file, and `keel scaffold service` placed it. k.check E1752 (principle 3: one export per file, filename equals export) reports it: the stem `api` is not `OrdersApi`. So every generated service tree failed `keel check`, the k.scaffold clause 1 service case was `it.skip`, and k.scaffold stayed `implemented`. Clause 4's printed `--dry-run` replay also lacked `transaction` and `service`; commit d1c3012 wired both through the cli, but the test table never added them.

## Proposal
1. The declaration file is `modules/<m>/<M>Api.schema.ts` and exports `<M>Api` (stem `OrdersApi` = export `OrdersApi`). `api.ts` keeps its name and its one export `api`, and imports `./<M>Api.schema.ts`. The client import path (`./api.ts`, `api.getOrder(...)`) does not change (principle 1). The schema file stays generated and read-only (E1005).
2. `openapi(doc, { name })` keeps its result shape `{ schema, service }`. Only the import inside `service` changes to `./<Name>Api.schema.ts`.
3. `scaffold("service", { id, schema, service })` writes `modules/<id>/<Pascal(id)>Api.schema.ts` and `modules/<id>/api.ts`. E1351 now fires on an existing `<Id>Api.schema.ts` or `api.ts`.
4. E1752 is unchanged. No exemption is needed.

Clause to test (strict verdict, task 0034 D1):

| section | # | clause | test | verdict |
| --- | --- | --- | --- | --- |
| k.scaffold | 1 | generator leaves `keel check` + `keel test` clean | `generators-leave-check-clean`: real `keel` binary for project, module, route, component, store, transaction, service (placed sources) and `keel scaffold service orders --openapi openapi.json` (real `openapi()` output) | covered |
| k.scaffold | 2 | `rename A B` + `rename B A` byte-identical | `rename-references` | covered |
| k.scaffold | 3 | no reference to the old name after `rename` | `rename-references` (free `href('id')` and member `routes.href('id', p)`) | covered |
| k.scaffold | 4 | `--dry-run` prints exactly the diff apply writes | `dry-run`: plan == apply for all 10 ops; printed diffs replayed by `unified-diff.ts` against the real cli write for all 10 ops, `transaction` and `service --openapi` included | covered |
| k.scaffold | 5 | would-introduce diagnostic -> E1353, nothing written | `E1353-aborts-would-break-check` | covered |
| k.scaffold | 6 | second run E1351, nothing written | `E1351-duplicate-id`, `transaction-file`, `service-file` | covered |
| k.scaffold | 7 | `turbo.json` equals output for the new graph | `turbo-emission` | covered |

k.scaffold flips to `conformance-covered`. k.services stays `conformance-covered`: its clauses are unchanged, and `openapi-client` still pins the generated files byte for byte under their new names.

## Alternatives
- Exempt `api.schema.ts` in E1752, the way `*.server.ts` is exempt: this puts a second address rule in check, for one file name, and principle 3 already gives the answer.
- One file per operation schema: N files plus a declaration file that still needs a name. It also splits the "one endpoint per operationId, in document order" declaration and changes nothing for the client.
- Rename the export to `api` in `api.schema.ts`: this collides with the service export `api` in `api.ts`, and the stem would still be `api`, not the declaration.
- Derive the filename from the export found in the `schema` text: this makes scaffold parse services' output. The module id already fixes the name (`<Name>Api`, k.services).

## Spec diff
- k.services API block: `// modules/orders/OrdersApi.schema.ts`, and `api.ts` imports `./OrdersApi.schema.ts`. The OpenAPI paragraph now says the sources are `<Name>Api.schema.ts` and `api.ts` (importing `./<Name>Api.schema.ts`), and that each file's name equals its one export (principle 3, E1752).
- k.scaffold Generators: `service` writes `modules/<id>/<Id>Api.schema.ts` and `api.ts`. Codemods: `rename` updates `href()` calls, whether the free form or a manifest's `routes.href()` (RFC 0041).
- k.scaffold `status: conformance-covered`.

## Conformance diff
scaffold: the `service` case of `generators-leave-check-clean` is un-skipped, and a new real-cli case runs `keel scaffold service --openapi` and then `keel check` + `keel test`. `dry-run` gains the printed `transaction` and `service` rows. `service-file` uses the new paths and gets a per-module `serviceInput(id)`, plus a new test that each placed file's name equals its one export. `rename-references` and the `withOrders` fixture use `routes.href(...)` (the fixture imports `routes` from `./routes.ts`). New fixtures: `apiName`, `serviceInput`, `ORDERS_OPENAPI`, `withOpenApi`. services: `fixtures/openapi/api.schema.ts` is renamed to `OrdersApi.schema.ts`, and `api.ts` imports it. No assertion is removed.

## Migration
- Projects with a generated or handwritten `modules/<m>/api.schema.ts`: rename it to `<M>Api.schema.ts` and change the import in `api.ts` to `./<M>Api.schema.ts`. E1752 already reports the old name.
- RFC 0041 (`href("id", p)` -> `routes.href("id", p)`): `codemod rename` of a route already rewrites the id in any string literal, including the argument of `<ident>.href("id", ...)`. The free and member forms both stay covered by `rename-references`. No scaffold template emits `href`. The conformance fixture page moves to the member form.

## Token impact
k.services +1 sentence and +1 line in the API block. k.scaffold +2 short clauses.
