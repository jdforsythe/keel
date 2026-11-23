# RFC 0199: k.scaffold: a service by its base, a route with no loader, and a refresh in place of a build

Status: implemented (ADR-0221). Amends k.scaffold (examples, Generators, new **Service** and **Refresh**, Rules, Conformance). Under D103 and D104. Settles backlog 0883, 1045 and 1048; from examples findings 12 and 16.

## Decisions
- D1: `keel scaffold service <module>` writes the same two files wherever the module is placed: `<Id>Api.schema.ts` and `api.server.ts`. Only `topology.ts` differs by placement.
- D2: in a module on a `client` deployable, `service` declares the API's origin under that deployable's `origins.connect`, with the reason the person gives as `--reason`. With no reason it refuses: E1358, nothing written. So its output never fails E1571.
- D3: `--base <url>` is the second form of `service`, beside `--openapi <file>`: an empty `endpoints({})`, the client, the `@keel/services` dependency and, by D2, the declared origin.
- D4: `keel scaffold route ... --no-loader` writes a page route with no loader file and a binding of `component` alone. The default keeps its loader on every adapter.
- D5: after an applied operation in a built project, the scaffold refreshes the files `keel check` reads (`.keel/` artifacts, generated deploy files). It builds no bundle and writes nothing under `dist/`. There is no flag to turn it off.
- D6: nothing prints while the refresh runs. The trailer gains an `artifacts` count.

## Problem
A front end with no back end that reads another organisation's API is a first-class app (D103, D104). Building one, `examples/client-only-api`, took 4 commands and 11 hand edits (examples finding 16). Three faults are behind that.

**The service generator fails check where the default project puts it (0883).** `opService` (`packages/scaffold/src/internal/opService.ts`) writes `api.server.ts` with a literal `base` into any module. The default project has one `client` deployable. In a module only `client` deployables list, a `*.server.ts` file ships to the browser (k.boundary), so the literal `base` is E1571 until the origin is declared under `origins.connect` (k.origins). The scaffold's check proxy (`diagnose.ts`) knows TS2307, E1151, E1152 and E1153, so nothing stops the write, and the Guarantee ("clean before, clean after") is broken. `packages/scaffold/conformance/service-file.test.ts` asserts that `service` succeeds in the default project.

**The generator takes only `--openapi` (1045).** `openapiInput` answers E1052 without it. An app calling one or two endpoints of a large public API has no document worth importing, so its author writes the schema file, the client and the `topology.ts` declaration by hand, and learns of the declaration from E1571. Separately, `opRoute` always writes a `load<Name>.server.ts` and binds it, though k.contract makes a page's `loader` optional: the example deleted both loaders and edited both bindings.

**A scaffold in a built project runs a whole build (1048).** `scaffoldCommand` calls `buildCommand` after its writes when the project holds a `.keel/` artifact, so that `keel check` finds no stale artifact (E1005). That build also bundles every deployable into `dist/`, which `keel check` never reads, and prints `W1005 .keel/routes.json differed from routes.ts; rewritten` for the change the scaffold itself made. Measured on this machine (16 cores, load 9; best of three, `node packages/cli/src/bin.ts`):

| | `examples/client-only-api` | `apps/golden-2` |
| --- | --- | --- |
| `keel build`, whole | 1.9 to 2.1 s | 7.0 to 7.3 s |
| of it: process start and file load | 0.31 s | 0.31 s |
| of it: check, compile, `.keel/` artifacts, deploy files | 0.72 s | 2.6 to 2.9 s |
| of it: `routes.json` and `surface.json` | 0.41 s | 0.75 s |
| of it: Vite bundles (one deployable; two) | 0.32 s | 3.59 s |

The bundles are a sixth of the cost in a one-page app and half of it in golden-2, and they grow with each deployable.

## Proposal
### What `service` writes, by placement
A module is in one deployable (k.topology). The two files are the same in each case.

| The module's deployable | Files | `topology.ts` | Needs `--reason` |
| --- | --- | --- | --- |
| `node` or `static` | `<Id>Api.schema.ts`, `api.server.ts`, `package.json` | unchanged | no; given, it is E1052 |
| `client`, origin not declared there | the same | `origins.connect` gains the origin | yes; absent, it is E1358 |
| `client`, origin already declared there | the same | unchanged | no; given, it is E1052 |

On a `node` or `static` deployable `api.server.ts` is server-only and the call leaves the server, so no browser policy applies. On a `client` deployable the file is a browser file; a page, a loader or an action of the module imports it. The name stays `api.server.ts` there, as `load<Name>.server.ts` does for a loader the browser runs, so a module's files do not depend on where it is placed.

A declared `connect` origin is an escape `keel review` lists as high danger with its reason (R1010). The scaffold never invents that reason: the person passes it, or the operation refuses, and `keel explain E1358` says how to go on.

```
E1358 topology.ts:4:3 orders is on client deployable web, which does not declare https://api.example.com
  see: keel docs k.scaffold
fail scaffold service 1 errors
```

### `--base`, end to end
```sh
keel scaffold service app --base https://api.github.com --reason 'the release list on the releases page'
```
In the default project (`web`, `client`, module `app`) it creates two files and changes two.

`modules/app/AppApi.schema.ts`, created, the author's to edit:
```ts
import { endpoints } from "@keel/services";

export const AppApi = endpoints({});
```
`modules/app/api.server.ts`, created, the author's to edit:
```ts
import { service } from "@keel/services";
import { AppApi } from "./AppApi.schema.ts";

export const api = service({ base: "https://api.github.com", schema: AppApi });
```
`topology.ts`, changed:
```ts
import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["app"],
    adapter: "client",
    styles: ["@keel/ui/fonts"],
    origins: { connect: { "https://api.github.com": "the release list on the releases page" } },
  },
});
```
`package.json`, changed: `dependencies` gains `"@keel/services"` at the version of `@keel/server`, keys sorted.

The schema file is empty because the scaffold cannot know an endpoint; the author adds each one, and E1652 and E1653 check them. The declared origin is the origin of `--base`: `https://api.example.com/v2` declares `https://api.example.com`. With `--openapi` the URL is `servers[0].url`, and the placement rules are the same.

Refusals, each writing nothing:

| Case | Diagnostic |
| --- | --- |
| both `--base` and `--openapi`, or neither | E1052 |
| `--base` not an absolute `http` or `https` URL, or with a query, fragment or credentials | E1052 |
| the module is unknown | E1052 |
| `<Id>Api.schema.ts` or `api.server.ts` exists | E1351 |
| module on a `client` deployable, origin not declared there, no `--reason` | E1358 |
| `--reason` with nothing to declare | E1052 |
| an origin k.origins does not take (`http` off `localhost`, an IPv6 literal), a reason out of its form, a 17th `connect` origin | E1353 naming E1590 |

E1358 is new, in k.scaffold's block. E1052 would name a missing flag and nothing else; this refusal has a cause in the project (the placement) and two ways out (`--reason`, or `keel codemod place <module> --to <name> --adapter node`), which `keel explain E1358` can say.

### A route with no loader
```sh
keel scaffold route app.home --path / --no-loader
```
creates `modules/app/HomePage.tsx` and the route test, adds the contract entry, and binds it:
```ts
import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import { app } from "./app.contract.ts";

export const routes = manifest(app, {
  "app.home": {
    component: HomePage,
  },
});
```
No `*.server.ts` file is written. `--no-loader` with `--api` is E1052: an API entry is its handler. The flag is the input field `'no-loader'`, as `--dry-run` is `'dry-run'`. The default does not change with placement: a loader in a `client` module is browser code, not server code, and a page that awaits its data before it renders wants one there too.

### The refresh
After an applied operation in a project holding a `.keel/` artifact `keel build` writes, the scaffold runs `keel build`'s steps up to the bundles: its check, the compile that writes `a11y.json`, `deps.json`, `ids.json`, `styles.json` and `std.json`, the generated deploy files, `routes.json` and `surface.json`. It stops there: no Vite build, no `csp.txt`, nothing under `dist/`. By the table above that is about 1.4 s in place of 2.0 s on `examples/client-only-api` and 3.8 s in place of 7.1 s on `apps/golden-2`.

`dist/` is then as old as it is after any hand edit; `keel build` writes it before a deploy, as now.

Output follows `docs/OUTPUT.md`: no line while the refresh runs, in any format, and no W1005 for an artifact the refresh rewrites, since the scaffold changed its source. The edit lines, any diagnostic of the refresh, then one trailer, which counts what the refresh wrote:
```
create modules/app/HomePage.tsx
create test/app.home.route.test.ts
change modules/app/app.contract.ts
change modules/app/routes.ts
ok scaffold route 2 created, 2 changed, 0 removed, 7 artifacts, 0 errors
```
When the refresh's check finds an error the tree already held, the edits stay written, the diagnostic prints, the trailer is `fail scaffold route` and the exit is 1, as with the build today.

### The example, replayed
From an empty folder, under this proposal:
```sh
keel scaffold project client-only-api
keel scaffold service app --base https://api.github.com --reason 'the release list on the releases page'
keel scaffold route app.home --path / --no-loader
keel scaffold route app.releases --path /releases --no-loader
```
Replayed in a scratch workspace project with these outputs written as the samples above give them, then filled with the example's content (a page importing `api` from `./api.server.ts`): `keel build`, `keel check`, `tsc --noEmit` and `keel test` (2 tests) pass.

| Hand edit today (finding 16) | Under the proposal |
| --- | --- |
| `origins.connect` in `topology.ts` | written by `service` |
| `@keel/services` in `package.json` | written by `service` |
| the client file | written by `service` |
| two loaders deleted | never written |
| the endpoints file | created empty; the author adds the `releases` endpoint |
| `routes.ts` | bindings written; the author adds the two `title`s |
| `Releases.schema.ts`, two pages, the masthead, the test | the author's |

Eleven hand edits become seven, each of them the app's own content: one endpoint, one schema, two titles, three components and a test. None is structure Keel knows.

## Alternatives
- **Refuse `service` in a `client` module.** It closes 0883 and leaves the client-only app with every hand edit; D103 asks for the opposite.
- **Write a default reason (`"the Orders API"`).** `service` would then succeed in the default project as the present conformance case has it. Rejected: the reason is what a reviewer reads to judge a high-danger escape, and a generated one says nothing.
- **A `<module>Api.ts` file in a `client` module.** Rejected: a module's file names would depend on its placement, and `codemod place` "changes nothing else".
- **A `--name` for the API (`GitHubApi`, `githubApi`), several per module.** Not proposed: k.openapi names the service by its module, and one module, one `api` holds for both forms. A second API goes in its own module.
- **No loader by default in a `client` module.** Rejected: the same command would write different files by placement, and a loader there is browser code a page may want.
- **Keep the whole build.** It pays for bundles `keel check` never reads, twice over on a two-deployable app, and writes production output as a side effect of a structural edit.
- **A `--no-build` flag, or print `run keel build` and stop.** Either leaves `keel check` failing E1005 after a scaffold, against the Guarantee, or makes every caller choose.
- **A refresh with no check first.** Not proposed: the check is most of what remains, but a refresh and a build then refuse the same trees, and its share was not measured apart from the compile.

## Spec diff
Applied in this commit, k.scaffold only; it stays `implemented` until the clauses below are covered. k.openapi, k.origins, k.cli and the map are unchanged, and no glossary term is added.
- Operations: two example lines.
- Generators: `route` (`--no-loader`, the input, E1052); `service` (points at **Service**).
- New **Service** and **Refresh** paragraphs.
- Rules: E1358.
- Conformance: seven clauses.

## Conformance diff
By the `conformance-writer`, from k.scaffold, in `packages/scaffold/conformance`:
1. **Service, `node`.** `service { id, base }` in a `--adapter node` project: exactly the two files with their one export each and no generated first line; `package.json` alone changed; check and test clean.
2. **Service, `client`.** The same with `reason` in the default project: `topology.ts` gains the `connect` entry, other properties kept; check clean; a `base` with a path declares its origin.
3. **Service, E1358.** No `reason` in the default project, both input forms: E1358 naming deployable and origin, nothing written; an origin already declared applies with no `reason`, `topology.ts` byte-identical, and with one is E1052.
4. **Service, E1052.** `reason` in the `node` project; `base` with `schema` and `service`; none; four malformed `base` values.
5. **Service, E1353.** In the default project an `http` origin, a 201-character reason and a 17th origin are E1353 naming E1590; `http://internal:8080` applies in the `node` project.
6. **Route.** `'no-loader': true` creates the page and the test alone, binds `{ component }`, writes no `*.server.ts`; clean in both projects; with `api: true`, E1052.
7. **Refresh.** In a built, clean project each generator leaves check clean with no E1005, `dist/` byte-identical, no W1005, `artifacts` above 0; `service --base --reason` in the default project is one; `--dry-run` and a never-built project write nothing under `.keel/`.

Existing cases the new text contradicts, for the `conformance-writer` to correct under `rfc:0199` (each applies `service` with no `reason` in the default `client` project, where the spec now says E1358):
- `packages/scaffold/conformance/service-file.test.ts`: "places the schema source and the service source verbatim" (34), "each placed file's name equals its one export" (50), "both placed sources start with the generated header" (61), "service --dry-run" (66), "E1351: running service twice" (99), "add-field to a schema in a placed OrdersApi.schema.ts" (142), "rename of a schema declared in a placed OrdersApi.schema.ts" (147), "operations that do not touch the placed sources" (158). Each holds again in a `node` project or with a `reason`. "E1351: an existing handwritten api.server.ts" (112) holds if E1351 is judged before E1358, which the build does.
- `packages/scaffold/conformance/dry-run.test.ts`: the `["service", SERVICE_INPUT, fresh]` row (31), and the CLI row `scaffold service orders --openapi openapi.json` (85), whose `withOpenApi` is the default project.
- `packages/scaffold/conformance/generators-leave-check-clean-after-build.test.ts` stays true and gains clause 7's `dist/`, W1005 and `artifacts` assertions.

## Migration
None for an app: the default `route` output and a `service` in a `node` module are unchanged. `keel scaffold service <module> --openapi <file>` in a `client` module now asks for `--reason`.

## What it costs
- k.scaffold: 5,986 to about 11,000 characters, about 2,750 tokens of the 3,100 a section may hold. The map is unchanged.
- MCP `tools/list`: the structural input gains `base`, `reason` and `no-loader`, on `scaffold` and `codemod`; the budget is 1,900 tokens, to be measured in the build.
- `@keel/scaffold` gains two templates and the `topology.ts` edit; `@keel/cli` gains the split of the build's disk half. Both have size budgets.
- `keel explain E1358`, one catalog entry.

## Build order
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: the seven clauses and the corrections above. 3. Build:
- `packages/scaffold/src/internal/inputs.ts`, `opService.ts` (the `base` form, placement through `topologyOf`, E1358, E1353 for what k.origins refuses through `@keel/compiler/hosting`), a new `topology.ts` edit beside `topologyAst.ts`, two templates; `opRoute.ts` and `templates/bindingEntry.ts` for `no-loader`.
- `packages/cli/src/operations.ts` (`base`, `reason`, `no-loader`; `method` is in the spec and absent from the structural flags today), `internal/scaffoldInput.ts`, `internal/openapiInput.ts` (`--openapi` optional beside `--base`), `internal/scaffoldCommand.ts`, and `internal/buildCommand.ts` with `internal/hostBuild.ts` split so the refresh runs the steps before `viteTargets`. In a project with a `client` deployable `routes.json` comes from the Vite build today (`routesRun` returns early); the refresh calls `buildRoutes` there.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1358; E1571's fix line names only the move to a `node` module and should name the `connect` declaration too.
- Docs: the keel and keel-server skills, the `@keel/scaffold` README, a changeset, `tasks/p1/examples-findings.md` (12, 16), `tasks/BACKLOG.md`.

Found on the way, not settled here: `codemod place` of a module holding a `base` service onto a `client` deployable leaves E1571, since the check proxy does not know it; the reverse leaves a declared origin nothing uses.

## For the operator
1. **A reason is required, so `service` in the default project with no `--reason` is refused (E1358).** This corrects ten conformance cases. Recommended: yes; a generated reason defeats `keel review`.
2. **The refresh replaces the build after a scaffold, with no flag (backlog 1048, open with the operator).** Recommended: yes; it keeps the Guarantee and drops the bundles, 2.0 s to 1.4 s and 7.1 s to 3.8 s here.
3. **A service is named by its module (`AppApi`, `api`), one per module, with no `--name`.** Recommended: keep; a second API is a second module.
4. **`route` keeps its loader by default in a `client` module (D103).** Recommended: keep; that loader runs in the browser and is no server part, and `--no-loader` is one flag away.
