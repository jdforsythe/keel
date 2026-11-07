# RFC 0034: Conformance completion for k.router, k.server, k.services

Status: accepted (ADR-0023)

## Problem
Backlog 0059. Under the strict verdict (task 0034 D1), the freeze review and a re-audit against the current spec found these gaps:
- **k.router.** E1501 was asserted only at the type level. The route round trip covered 4 of 10 routes. A non-empty `search` passed the "`{}`" clause. Optional-key omission was checked on one route only. Error-slot containment inside the layouts was not asserted. `<Form method>` had no trigger for a verb outside the four.
- **k.server.** The dev log stream clause was `it.todo`: the spec named no in-process sink. "Lists the field errors" was checked as a substring. `Location` was compared by pathname only. Two 413 cases never asserted the code.
- **k.services.** The OpenAPI client clause was `it.todo`: no generator existed. The `ok` and 409 decodes used schemas that return the raw JSON unchanged, so a pass-through would also pass. `api.decode` was checked on status 200 only. The never-throws property skipped null-body statuses. E1651-E1653 were `it.todo`, although `@keel/check` has implemented them since RFC 0031.

## Proposal
- **E1501.** Router conformance asserts E1501 as a diagnostic through the public `compile` from `@keel/compiler`; `tooling/deps.json` allows router to import compiler. The cases are `href`, `action`, `formaction` and `Link to` literals, a relative literal matching a route pattern, and their clean counterparts. A `navigate('/x')` string stays type-level here; the k.check fixture is its diagnostic.
- **Dev log sink.** The spec now states `createApp({ log: { format, write } })` as the stream's sink, as already shipped. The dev entry passes stdout.
- **OpenAPI generator.** `openapi(doc, { name })` from `@keel/services/openapi` returns `Result<{ schema, service }, SchemaError>`. It is build-time and pure, and its output is the source of `api.schema.ts` and `api.ts`. The subset it accepts and its error paths are in the k.services OpenAPI paragraph. The subpath keeps it out of the client bundle.
- **E1651-E1653.** Services conformance asserts them through the public `check(files, { types: false })`; services follows check in `deps.json`.

## Clause -> test plan
| section | clause | test |
| --- | --- | --- |
| k.router | navigate round trip, every route | `navigate-roundtrip` (10 routes, `gen` params/search) |
| | href deterministic; omits absent optionals | `href-deterministic` (orders.list, orders.show) |
| | params fail: 404, no loader | `params-fail-404` |
| | `?tab=bogus&x=1` gives `{}` | `search-drop-invalid` (`toEqual({})`) |
| | guard err redirects; no loader, no render | `guard-denied-redirect` |
| | loader err: nearest errorElement inside layouts | `loader-error-slot` (containment) |
| | `ok(null)` reruns each loader once; `ok(href)` target | `action-revalidate` |
| | push focus/scroll; back restores | `push-focus-scroll` |
| | E1501-E1506 trigger + clean | `rules-e1501-e1506` (E1501 via `compile`; E1505 `Form method="GET"`) |
| | inferred params; E1507 | `loader-params-inferred` |
| k.server | params fail 404 | `params-fail-404` |
| | loaders start together | `loaders-start-together` |
| | loader notFound: 404 + errorElement | `loader-notfound-error-element` |
| | invalid FormData: 422, no call, field errors | `post-invalid-formdata-422` (`keel.fields` data exact) |
| | 303 `Location: href` / request URL | `action-redirect-303` (exact `Location`) |
| | production throw 500 | `production-throw-500` |
| | one `req` per request; json lines parse | `dev-log-stream` (property over mixed request sequences, both formats) |
| | 413 `keel.payloadTooLarge`, no call | `body-cap-413` (JSON, FormData, default cap) |
| | loader `url` absolute | `loader-url-absolute` |
| | `undoOwn` per caller | `undo-own-caller` |
| k.services | 2xx ok decoded | `ok-decodes-output-transformed` (secret field via `reveal`) |
| | 2xx failing output: `api.decode` | `decode-failure-all-2xx` (all 2xx, non-JSON and empty body) |
| | `api.input` paths, nothing sent | `api-input` |
| | timeout at `timeout`, abort | `timeout` |
| | 409 decoded; 500 `body: null` | `status-errors`, `status-errors-decoded-body` |
| | `api.network` | `network-failure` |
| | `a%2Fb` | `param-encoding` |
| | never throws | `never-throws`, `never-throws-null-body` (204/205/304) |
| | OpenAPI fixture client | `openapi-client` (generated files equal the committed `fixtures/openapi/*`; keys = operationIds; `expectTypeOf` input and output vs a hand declaration for all 7 operations; sim round trip; subset errors) |
| | Rules E1651-E1653 | `E1651-check`, `E1652-check`, `E1653-check` via `check()` |

## Alternatives
- Test the log stream through `keel dev` stdout: this needs a live Vite server, and `keel dev` hands the terminal to Vite.
- Put the OpenAPI generator in `@keel/scaffold`: scaffold precedes services in `deps.json`, so a services test could not import it. The spec already names the generated files as k.services output.
- Assert E1501 through `check`: check follows router in `deps.json`.

## Spec diff
- k.server Dev server: one sentence on the `createApp({ log })` sink.
- k.services: new **OpenAPI** paragraph.
- Status flips are listed below. Map rows are updated to match.

## Conformance diff
Added and strengthened only, listed per file in the plan above. No assertion is weakened. The edit guard refuses tracked services files, so the services additions are new files. This commit deletes the four `it.todo` files they supersede: `services/conformance/openapi-fixture`, `E1651`, `E1652` and `E1653`. `server/e1551-server-file` stays `it.todo`, because `check` has no rule for it yet (backlog 0062). The generated files are biome-stable, with layout matched by a property test. The services Stryker config limits `disableTypeChecks` to `src` and `test`, so the committed fixtures stay byte-identical.

## Migration
None. `keel scaffold service --openapi` still has to call `openapi()`. Scaffold cannot import services, so the cli must read the file and hand the sources to scaffold (backlog follow-up).

## Token impact
k.server 1406 -> 1441 tokens. k.services 817 -> 1154 tokens. Both stay at or under 1,500.
