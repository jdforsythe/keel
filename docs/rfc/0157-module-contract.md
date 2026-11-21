# RFC 0157: k.contract: one contract per module

Status: implemented (ADR-0179). Design RFC for workstream W13 step 1 of `tasks/p1/PLAN.md`, under decisions D41 and D42 of `tasks/0963-to-p1/PLAN.md`. It lands before the kernel freeze flip.

## Decisions
- D1: each module that serves a route has one contract, `modules/<id>/<id>.contract.ts`, exporting `<id>` = `contract('<id>', { ... })` from `@keel/router/contract` (D19). A stdlib module's contract is its package's `./contract` export. The file is client-safe: it imports `*.schema.ts` files and packages only (E1514).
- D2: a contract entry is keyed by its route id and is one of three kinds told apart by required members, as k.api's arms are today: a page `{ path, params?, search? }`, a layout `{ layout: true }`, an API entry `{ method, path, params?, query?, body?, output, errors?, timeout?, events? }` (the k.services `Endpoint` shape). An API entry's id is `<module>.<name>` with `name` one lowerCamel segment, the name of its client method.
- D3: `routes.ts` binds every entry and nothing else: `export const routes = manifest(contract, binding)`. A page binds `component` and optionally `loader`, `guard`, `layout`, `errorElement`, `title` and its actions by verb; a layout `component`, `loader?`, `guard?`, `layout?`, `errorElement?`; an API GET `loader`, `guard?`; an API write `action`, `guard?`. A missing, extra or mismatched binding is a type error (E1515). `routes.actions` goes.
- D4: a handler names its entry: `loader(contract, id, { output?, stores? }, fn)` and `action(contract, id, { input?, stores? }, fn)`. `fn`'s params, search or query, body and answer are typed from the entry. A page or layout loader declares its view's `output`; an API loader takes the entry's. A page action declares its form's `input`; an API action takes the entry's `body`. E1507 and E1512 have nothing left to catch and are retired.
- D5: what derives from the contract: `<contract>.href(id, params?, search?)` for its pages (`routes.href` goes); `service({ contract, timeout? })`, one client method per API entry; `routes.json` and `.keel/surface.json`; the module's public routes. `service({ module, schema })` goes. `service({ base, schema: endpoints({...}) })` stays for a service no app module serves.
- D6: E1561 is unrepresentable in one build and is removed: the client and the handler read one entry. Its code is retired and never reused.
- D7: E1562 stays and compares one object, a contract's API entry in the base surface with the same entry now. `surface.json` moves to `version: 2`.
- D8: E1504 stays for a page's `search`. An API entry's `query` may require keys; the server decodes it after the guard, with the body, and a failure is 422 `keel.fields` with nothing run.
- D9: the contract removes the circular initializer that ADR-0052 gives as the reason for `routes.actions`. `href` lives on the contract, which holds no handler, so no handler's type depends on the table that binds it. Actions go back into the entry.
- D10: RFC 0086 D2 is reopened and settled: an API route's handler sits in its binding entry, and its method is the contract entry's `method`. RFC 0086 D1's tag survives as a required member: `method` marks the API kind where `api: true` did.
- D11: the module manifest loses `public.routes`. Every entry of a contract is public to each module that lists the serving module in `deps`; importing the contract needs `deps` only (E1152), never `public.exports`. E1157 and the route half of E1154 are removed.

- D12: a deployable's route table is `routeTable(...tables)` from `@keel/router`, the union of its modules' manifests; a manifest is a route table of one module, so everything that takes routes takes either (k.routes, Proposal 10).
- D13: a layout's place is in the binding, never the contract: a page or layout binding names its layout with `layout?`, a layout id of its own contract or of another module's, so chains nest to any depth and an app shares one shell across feature modules; `manifest` throws E1506 for an own id that is no layout, an id not `<module>.<name>` or a cycle in its contract, and `routeTable`, or a manifest served alone, for another module's id that names no layout entry of the table or a cycle across modules; `keel check` reports E1152 at a `layout` whose module is not in `deps` (Proposal 11).
- D14: where each code fires is one table in k.routes (Proposal 12).
- D15: `surface.json` v2 has a stated key layout with an example file (k.compat, Proposal 13).
- D16: `keel scaffold route` takes `{ id, path, file?, api?, method? }` (k.scaffold, Proposal 14).
- D17: the server render passes the `createApp({ ctx })` object itself, the one its loaders get (k.router; RFC 0162 D2).
- D18: std-sessions, std-channels and std-offline over contracts are specified now, in std.contracts, a new section; a channel's two entries are written out in the serving contract and its handlers come from `channelRoute` (Proposal 15, D32).
- D19: `contract` and its types live in a new entry, `@keel/router/contract`, which imports `@keel/schema` only; `@keel/router` does not re-export it. `@keel/services` and `@keel/std-offline` take the contract's types from it (Proposal 16).
- D20: across modules any shared path pattern is E1502, methods aside.
- D21: no code is renumbered: E1407 and E1513 to E1515 collide with none of the other lanes' new codes (E1590, E1591, E1585, E1607, E2451 to E2458, E1824, E1825, E1161 to E1164).
- D22: no migration (D65 of `tasks/0963-to-p1/PLAN.md`): nothing is released and the golden apps are the only apps, so there is no codemod, no `surface.json` of another version to accept and no compatibility case; the build lane rewrites the apps, fixtures and skills directly (Build order).
- D23: a deployable takes in a stdlib module's routes only through `routeTable`, read statically from the package's `./contract` and `./routes` files; no `routes.ts` spreads another module's routes, and W1005 names a contract or binding part that is not literal (k.compiler, Proposal 17).
- D24: a loader is live exactly when its entry is an API GET with `events: true`; a page or layout loader is never live (k.server, Proposal 18).
- D25: `keel check` reports the type errors of E1155, E1506, E1510 and E1515 under those codes, never E1751, mapped from the position of the error in the `contract` or `manifest` argument, whatever its TypeScript code; the argument types are mapped types keyed by id so each error lands at the offending key or member (k.routes, Proposal 12).
- D26: a route table's public members are `kind`, `contracts` and, on a manifest, `contract`; its bindings are reached only through `bindingsOf` from `@keel/router/internal`, and code outside the kernel reads ids, paths, methods and schemas from the contracts (Proposal 2).
- D27: the router keys its table by path pattern; a pattern holds one page or one module's API entries at distinct methods, and a method none of them has is 405 with the pattern's methods in `allow` (k.api, Proposal 19).
- D28: `contract` throws E1513 only for an API name; the file and folder cases are `keel check` only (Proposal 7).
- D29: `channelRoute(contract, channel, { id, publish?, stores, member })` takes the serving module's contract first, as `loader` and `action` do, declares its handlers through it and returns `{ loader, action }`, which the binding names by entry; an entry at those ids whose members are not the channel's own (`path`, `params` as `query`, `events` as `output`, `body`) is a type error where the types differ and E1515 naming the members. A handler binds only through the contract it is bound in (Proposal 15).
- D30: an API write that answers nothing has `output: s.object({})` and answers `ok({})` (k.api Output); std-channels' publish entry is one. The schema library gains no `s.null()`.
- D31: module `sessions` has one contract: `sessions.tally` (std.monitor) is an entry of `@keel/std-sessions/contract` bound in its `./routes`, so placing the module serves it; `monitorRoutes` goes, the `monitor` runner only fills the tally, and E2009 reads `runners.server.ts` only, since a non-`node` deployable serving `./routes` is E2005 (Proposal 15).
- D32: the static readers read a contract as written, for any package alike: literal keys; in each entry literal `method`, `path`, `layout` and `events`, and `params`, `search` and `query` schemas followed through consts and imports; any other member any expression. A spread or call for the entries or an entry is W1005 and E1111 (at the spread; the entries beside it are still read). So no helper returns entries: `channel` gives the schemas a channel's entries name (`events`, `body`), and the contract writes the entries out (k.contract Static reading, Proposal 15). No spread is followed, not even of a const object literal in the file or a client-safe import: following one would put an id, method or path outside the call, where E1111 and `routes.json` read it but `grep` and a reviewer do not, and every reader would need the same following rule; one rule, object literals in the call, keeps the two readers one reader (`readContract` in `@keel/compiler/internal`, which E1111 and the `routes.json` reader share). A name for the entries or an entry is read as a spread is. `publish` missing for a channel with `message` is a type error only: `channelRoute` then returns the loader alone, and `manifest` throws E1515 for the publish entry left unbound.
- D33: a link is checked where it is followed, on the server and in the client, by one predicate (`isHref`): a page action's `ok` value that is neither `null` nor an `Href` is `keel.unexpected` before any save, on the document and the JSON transport (500, no `Location`, nothing echoed) and in the client router (the `Form` gets it, nothing navigates); `navigate` rejects with E1501 a value that is no `Href` once each `\` reads as `/` and a hash drops (a raw `/a/\x` stays the document navigation k.mount-scope tests), a `Form` whose `action` is none throws E1501, and a `Link` renders `about:blank`. A control character is C0, DEL or C1 (k.router Links).

## Problem
Every endpoint between two modules is declared twice today, once by the serving module and once by each caller, and a check compares the copies.

1. **The serving side.** `apps/golden-2/modules/kitchen/routes.ts` declares four API routes with `api: true`: `kitchen.recipes` (GET and POST on `/api/recipes`), `kitchen.favorite`, `kitchen.catalog` and `kitchen.tally.currency`. Their schemas sit on the handlers: `loadCatalog` declares `output: CatalogResult, params: CatalogParams, search: CatalogSearch`, which `manifest` requires to be the route's own values (E1507); `postRecipe` declares `input: RecipeDraft, output: Nothing`.
2. **The calling side.** `apps/golden-2/modules/recipes/kitchen.service.ts` declares the same four operations again with `endpoints({...})`: each method, path, params, query, body and output, importing the kitchen schemas across the module boundary. `recipes/ErrorReply.schema.ts` declares the kitchen routes' error answer on the caller's side. golden-1 has four such files (`digest/board.service.ts`, `todos/todos.service.ts`, `todos/boardWrites.service.ts`, `todos/suggestions.service.ts`) for one `api` module; `/api/lists` is declared in three of them.
3. **The check between them.** k.compat E1561 evaluates `routes.ts` and every endpoints file a `service({ module })` names, writes both into `.keel/surface.json`, and compares them with an accepts relation (`packages/check/src/internal/compat/compatChecks.ts`, 264 lines with its helpers at 911). It catches drift after the fact, at `keel check`, as a diagnostic on the caller; the type checker sees two unrelated declarations. Backlog 0428 and 0936 are open against it.
4. **The second declaration is on the wrong side.** A caller that wants a field the server does not send writes it into its own endpoints file, and the error is reported in the caller's file against a route it does not own. The serving module cannot see who depends on which of its routes except through `public.routes`, a list of ids kept beside the routes by hand.
5. **Links pull in views.** A page builds hrefs with `routes.href`, so it imports its module's `routes.ts`, which imports every component and handler of the module. k.boundary stubs the server files in a browser build so that this import works (k.boundary, ARCHITECTURE "Server boundary"). A link to another module's page needs that module's `routes.ts` too.
6. **`routes.actions` is a second statement for one route.** ADR-0052 moved actions out of the entry because an action returning `ok(routes.href(...))` made the manifest's initializer circular (TS7022). The cycle is real (sample below), and the cure splits each route across two statements in `routes.ts`, with a `WeakMap` keyed by entry objects (`routeActions`), a sealing step (`compileTable`), and a static reader that follows `routes.actions` calls through `const` aliases (`routeLiterals`).
7. **Required query keys are refused everywhere.** E1504 forbids a required field in a route's `search`, a rule written for pages, where a person can type any URL and a failing key is dropped. An API route has the same rule, so `CatalogSearch` cannot require a key even though every caller is a typed client that validates the query before sending it (`api.input`).
8. **The handler's schemas are repeated.** A loader declares `params` and `search` that must equal the route's (E1507); an API action declares an `output` that the caller's endpoint repeats. E1507, E1512 and E1561 exist only to compare copies.

## Proposal

### 1. The contract file
```ts
// modules/kitchen/kitchen.contract.ts
import { contract } from '@keel/router/contract'
import { Tally } from '@keel/std-report'
import { Box } from './Box.schema.ts'
import { CatalogParams } from './CatalogParams.schema.ts'
import { CatalogResult } from './CatalogResult.schema.ts'
import { CatalogSearch } from './CatalogSearch.schema.ts'
import { ErrorReply } from './ErrorReply.schema.ts'
import { Nothing } from './Nothing.schema.ts'
import { RecipeDraft } from './RecipeDraft.schema.ts'
import { RecipeRef } from './RecipeRef.schema.ts'

/** The kitchen module's routes: the box, adding to it, favorites, one catalog page, the currency tally. */
export const kitchen = contract('kitchen', {
  'kitchen.box': { method: 'GET', path: '/api/recipes', output: Box },
  'kitchen.add': { method: 'POST', path: '/api/recipes', body: RecipeDraft, output: Nothing, errors: { 422: ErrorReply } },
  'kitchen.favorite': {
    method: 'POST', path: '/api/recipes/:recipeId/favorite', params: RecipeRef, output: Nothing, errors: { 404: ErrorReply },
  },
  'kitchen.catalog': {
    method: 'GET', path: '/api/catalog/:locale', params: CatalogParams, query: CatalogSearch, output: CatalogResult,
  },
  'kitchen.currencyTally': { method: 'GET', path: '/api/tally/currency', output: Tally },
})
```
- **Placement.** One per module, at `modules/<id>/<id>.contract.ts`; its one export is named for the module and is the value of one `contract(id, entries)` call whose `id` is the folder's module id (E1513). The filename follows the `*.schema.ts` convention: the stem is the export. A module with no route has no contract. A stdlib module ships its contract at its package's `./contract` export.
- **Client-safe.** The file imports `*.schema.ts` files (its own module's, or a public export of a module in `deps`) and packages, nothing else (E1514): no component, handler, guard, store or `routes.ts`. A browser bundle that imports a contract therefore imports schemas only, and k.boundary's E1007 still catches a schema file that reaches server code.
- **Keys.** Each key is a route id, prefixed by the module id (the type refuses another prefix; E1155 in `keel check`). An API entry's id is `<module>.<name>`, `name` one lowerCamel segment (E1513), since it names the client method.
- **Kinds.** Told apart by required members, so no kind is reached by leaving a member out:

| Kind | Requires | Optional | Refuses |
| --- | --- | --- | --- |
| page | `path` | `params`, `search` | `method`, `layout`, `query`, `body`, `output`, `errors`, `events`, `timeout` |
| layout | `layout: true` | | every other member |
| API | `method`, `path`, `output` | `params`, `query`, `body`, `errors`, `timeout`, `events` | `search`, `layout` |

  `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`. Two API entries of one contract may share a path pattern at different methods (`kitchen.box` and `kitchen.add`); two entries at one pattern and one method, or a page and an API entry at one pattern, are E1502 (Proposal 19). E1503 (params against path), E1504 (page `search` fields optional) and E1653 (no `body` on a GET) are read from the contract's literal.
- **The value.** `contract` returns a frozen `{ kind: 'keel.contract', module, entries, href }`. It holds schemas and strings only.

### 2. The binding
```ts
// modules/kitchen/routes.ts
import { manifest } from '@keel/router'
import { kitchen } from './kitchen.contract.ts'
import { loadCatalog } from './loadCatalog.server.ts'
import { loadCurrencyTally } from './loadCurrencyTally.server.ts'
import { loadRecipes } from './loadRecipes.server.ts'
import { postFavorite } from './postFavorite.server.ts'
import { postRecipe } from './postRecipe.server.ts'

export const routes = manifest(kitchen, {
  'kitchen.box': { loader: loadRecipes },
  'kitchen.add': { action: postRecipe },
  'kitchen.favorite': { action: postFavorite },
  'kitchen.catalog': { loader: loadCatalog },
  'kitchen.currencyTally': { loader: loadCurrencyTally },
})
```
`manifest(contract, binding)` takes the binding as one object keyed by the contract's ids. Every entry is bound and nothing else is (E1515: a type error; `manifest` throws it for a caller the type did not stop):

| Entry | Binding requires | Binding takes | Binding refuses |
| --- | --- | --- | --- |
| page | `component` | `loader`, `guard` (with `redirect`), `layout` (a layout id of the contract or of another module's), `errorElement`, `title`, `POST`, `PUT`, `PATCH`, `DELETE` | `action` |
| layout | `component` | `loader`, `guard` (with `redirect`), `layout` (a layout id of the contract or of another module's), `errorElement` | everything else (`title`, the verbs, `action`) |
| API GET | `loader` | `guard` | everything else |
| API write | `action` | `guard` | everything else |

A page's actions sit in its entry by verb; an API entry's one handler sits under `loader` or `action`, its method being the contract's. A handler bound under an id must have been declared for that id (E1515).

**What a manifest is (D26).** `manifest(contract, binding)` returns a frozen route table of one module, `{ kind: 'keel.routeTable', contract, contracts: [contract] }`; `routeTable(...tables)` returns `{ kind: 'keel.routeTable', contracts }` with no `contract` (Proposal 10). Those are the public members: no `routes`, `href` or `actions`. The bindings are no public member: kernel code reaches them through `bindingsOf(table)` from `@keel/router/internal`, a `ReadonlyMap` from each id to `{ contract, entry, binding }`, built when the table is made. The readers of `.routes` today move to it: the server (`packages/server/src/createApp.ts:126`, `internal/start.ts`), the router (`matchHref`, `createRouterWith`, `routesArtifact`) and the cli (`surfaceOf.ts`, `surfaceRun.ts`). Everything outside the kernel needs only what a contract holds, which is public: each contract's `entries` give every id's kind, `path`, `method` and schemas, with no handler. So std-sessions, which must not import a kernel `internal` entry (D67 item 3), changes as follows: `redactSession` (`packages/std-sessions/src/redactSession.ts:27`) matches with `matchHref(table, href)` as today and reads the matched id's `path`, `params` and `search` from the entry of the contract in `table.contracts` whose `entries` hold that id; `commandJob` (`commandJob.ts:20`) unions its tables with `routeTable(...job.routes)` in place of its own `Object.assign` over `.routes`, and reads each `nav`'s schemas the same way. No public API is added for it: the contracts are the read-only view of a table's entries, with no handler in them.

### 3. Handlers name their entry
```ts
// modules/kitchen/loadCatalog.server.ts
export const loadCatalog = loader(kitchen, 'kitchen.catalog', { stores: boxStores }, async ({ params, search, stores }, ctx) => {
  const recipes = stores.box.get('recipes')
  currencyTally(ctx, recipes)
  const rows = recipes.map((r) => ({ ...r, currency: r.price.currency }))
  const page = await time(ctx, 'kitchen.catalog.query', () =>
    applyQuery(catalogColumns, rows, search, { pageSize: 5, locale: params.locale }))
  return ok(page)
})
// modules/kitchen/postRecipe.server.ts
export const postRecipe = action(kitchen, 'kitchen.add', { stores: boxStores }, (body, { stores }, ctx) => {
  const wanted = body.title.toLowerCase()
  if (stores.box.get('recipes').some((r) => r.title.toLowerCase() === wanted))
    return err({ code: 'keel.fields', message: 'Already in the box', data: { title: 'Already in the box' } })
  // ...
  return added.ok ? ok({}) : err(added.error)
})
```
- `loader(contract, id, decl, fn)`: `fn` gets `{ params, search, url, caller, user, bearer, stores, signal }` and `ctx`, as today. `params` is `Infer` of the entry's `params` (`{}` without), `search` of a page's `search` or an API entry's `query`. On an API GET entry `decl` is `{ stores? }` and `fn` returns `Result` of the entry's `output`; with `events: true`, `fn` is an async generator (a live loader, k.server), and a plain `fn` is E1515; an async generator `fn` on any other entry is E1515 too (Proposal 18). On a page or layout `decl` is `{ output, stores? }`: the view's data is the module's own and not part of the contract. A layout loader's `params` are the matched route's, unparsed (`unknown`), as today.
- `action(contract, id, decl, fn)`: on an API write entry `decl` is `{ stores? }`, `fn` gets the decoded `body` (the closed empty object without one), `{ params, url, caller, user, bearer, stores }` and `ctx`, and returns `Result` of `output`. On a page `decl` is `{ input, stores? }` and `fn` returns `Result<Href | null>`; which verb it answers is the binding's key.
- `fn` is never annotated. The declaration's `id` is a type argument that the binding reads, so a handler moved to the wrong key fails to compile.
- E1551 (handlers in `*.server.ts`), E1558 (live loaders and `stores` only on a `node` deployable) and E1113 (no `s.secret` in an `output`, now read from the entry) are unchanged.

### 4. What derives from it
- **Links.** `kitchen.href(id, params?, search?)` takes a page id of that contract: `params` required iff declared, `search` typed by it, encoded as k.router Links says. A layout or API id does not compile. A page imports its own module's contract for links, not `routes.ts`, and a link into another module imports that module's contract: `accounts.href('accounts.signin', { locale })`. `Link to`, `navigate`, `Form action` and the URL policy still take an `Href`. Guard `redirect` still names a page id of the guard's module.
- **Clients.** `service({ contract, timeout? })` returns one method per API entry, named by the id after the module (`kitchen.box` is `kitchenApi.box`). A method's input and answer are today's `Client` (k.services): `{ params?, query?, body?, signal?, bearer?, user? }` and `Result<output, ApiError>`, with `errors[status]` decoding a declared status. Requests are resolved by k.topology from `contract.module`, as `service({ module })` is today. A page entry has no client method. `service({ base, schema })` keeps `endpoints({...})` for an outside service; E1567 still refuses a `base` service whose endpoint a contract of the app serves.
- **Routes table and artifacts.** `routes.json` is written from the binding and the contract: an API entry gains `method`; `actions` lists a page's bound verbs, or an API write entry's `method`. `surface.json` (k.compat) records contracts, below.
- **Public surface.** A contract is the module's public route surface: any module with the serving module in `deps` may link to its pages and call its API entries, and none may name an id the contract lacks (a type error at `href` and at the client). Importing `<id>.contract.ts` is a cross-module import that E1152 checks against `deps`; E1151 never applies to it. `public.exports` stays for components, schemas and functions.

### 5. ADR-0052's circular initializer goes
The cycle needed one value to be both the source of `href` and the table whose type depends on the actions. A minimal model of each design, checked with TypeScript 5.9.3 (`--strict`):
```ts
// before.ts: actions in the entry of the table that also provides href
export const routes = manifest({
  'a.home': { path: '/' },
  'a.new': { path: '/new', POST: action(() => ok(routes.href('a.home'))) },
})
// error TS7022: 'routes' implicitly has type 'any' because it does not have a type annotation and is
//   referenced directly or indirectly in its own initializer.
// error TS7024: Function implicitly has return type 'any' ...

// after.ts: href on the contract, actions in the binding
export const a = contract({ 'a.home': { path: '/' }, 'a.new': { path: '/new' } })
export const routes = bind(a, {
  'a.home': {},
  'a.new': { POST: action(() => ok(a.href('a.home'))) },
})
// no error
```
The second file type-checks because `a.href`'s type is fixed by `a`, which no action references. The same holds at runtime: a handler file imports the contract, never `routes.ts`, so the TDZ error ADR-0052 records ("a module that imports an action file before `routes.ts`") cannot occur. `routes.actions`, `routeActions`, the `compileTable` seal for late attachment and the `routes.actions` reader in `routeLiterals` go; the binding is one literal the compiler reads as it reads a manifest today.

### 6. Required query keys (E1504)
E1504 stays for a page's `search`: a person or a stale link can send any URL, so every key is optional and a failing key is dropped (k.router Matching). An API entry's `query` is a request part like `body`, sent by a typed client that refuses a bad one before sending (`api.input`), so it may require keys. The server's order on an API entry is: match, params (fail: 404), guard (deny: 403), then `query` and `body` (fail: 422 `keel.fields`, issue paths prefixed `query` or `body`, no loader or action runs). The separate words `search` and `query` mark the separate rules: one is a link's typed state, the other a request's input.

### 7. The rules
- **E1510** (rewritten, k.contract): a contract entry of no kind or of two (`method` with `search`, `layout` with `path`, a page with `output`), or a binding member its entry refuses (a `component` on an API entry, an `action` on a page). Type error where the literal is checked; `contract` or `manifest` throws it. Fix: remove the refused member; none for a contract entry missing a required member (an API entry without `output`).
- **E1513** (new, k.contract): a `contract()` call outside `modules/<id>/<id>.contract.ts` or a package's `./contract` export, a second one in the file, its `id` not the folder's module id, its export not named `<id>`, a module's `routes.ts` binding another module's contract, or an API id whose name after the module is not one lowerCamel segment. In `keel check`, every case. At run time `contract` throws the API-name case only, the one it can read from its arguments; it never sees the file it is called from or that file's folder, and `manifest` never sees which file imports it, so the placement, second-call, folder-id, export-name and other-module cases are `keel check` only. No fix (the checker cannot choose the file); the message names the expected path.
- **E1514** (new, k.contract): a contract file importing anything but a `*.schema.ts` file or a package. In `keel check`, at the import. No fix.
- **E1515** (new, k.contract): `manifest(contract, binding)` with an entry not bound, an entry bound without its required member (a page or layout without `component`, an API GET without `loader`, an API write without `action`), a key that is no entry of the contract, a handler declared for another id or another contract, a plain loader on an `events: true` entry, or an async generator loader on any other entry. Type error; `manifest` throws it, naming the first id. Fix: none for a missing binding or member; removes an extra key.
- **Kept:** E1155 reads contract keys; E1502, E1503, E1504, E1653 read the contract; E1505 is a `<Form method>` that is no verb, or names a verb with no action bound on the target page; E1508, E1509, E1511 (an API entry in a module a `client` or `static` deployable serves), E1551, E1558, E1567, E1652 (for `endpoints`) unchanged.
- **Removed, codes retired:** E1561 (k.compat), E1507 and E1512 (k.router, k.api), E1157 (k.module); the route half of E1154. `keel explain` keeps an entry for each retired code saying which rule replaced it until the 1.0 reset of the code table.

### 7a. What enforces "every endpoint in a contract"
The gate of W13 is that no endpoint is declared outside a contract in either golden app. Four mechanisms hold it, none new beyond E1513:
- `manifest` takes a contract, so a route exists only as an entry of one.
- `service` takes a contract or a `base`; `service({ module })` no longer exists.
- E1567 refuses a `base` service aimed at a path a contract serves.
- E1651 (`ctx.net.fetch` in app code) still forbids a hand-made request.

### 8. k.compat: the surface and E1562 over one object
`.keel/surface.json` holds `version: 2`: for each contract, its `module`, the modules that import it (`callers`), and each API entry's id, method, path and its `params`, `query`, `body`, `output` and `errors` as JSON Schema; the `stores` part is unchanged. Pages and layouts are not recorded: no module calls them, and a link that fails a page's params is a 404 the page already answers. The build evaluates each contract file (no handler runs); one that throws is E1006 and fails the build.

`keel check --base <file>`, for each API entry of each base contract with a base caller in a different deployable from the contract's module now: the current entry must exist, its `params`, `query` and `body` must accept the base entry's, and the base entry's `output` and each `errors[status]` must accept the current ones (E1562 at the current entry's member, naming the id; fix as today for one added required object field; an entry removed or moved to another method or path is E1562 with no fix). A base file absent, not JSON, or not a `version: 2` surface is W1568 and no E1562: the generated CI's first run on a new project has no base. E1563 and W1564 (stores) are unchanged.

### 9. Room for the additive items
Each contract member is a schema value, so `pick`, `omit`, `extend` and `partial` (W13 step 4) produce values that fit in place with no change to `contract`. A cross-field check with a field path is a schema refinement on `body` and surfaces as `keel.fields` at that path. Param names inferred from the path would make `params` derivable from `path`: the entry keeps `params` optional, so that item only widens what an entry may omit. A schema family in one file is a `*.schema.ts` file the contract imports (E1514 allows it). None of them adds a member to a contract entry, and `contract` refuses unknown members, so each item's RFC is the place to add one if it must.

### 10. The route table (D12)
Today the generated entry spreads each module's `routes.routes` into one `manifest({...})` (`packages/compiler/src/internal/devEntryCode.ts`); with a contract per module there is no entry literal left to spread, and k.router's "their union" named no API. `routeTable(...tables)` from `@keel/router` is that API:
```ts
// a hand-written entry or a test; the generated entries emit the same call
import { routeTable } from '@keel/router'
import { createApp } from '@keel/server'
import { routes as health } from '@keel/std-health/routes'
import { routes as kitchen } from './modules/kitchen/routes.ts'
import { routes as recipes } from './modules/recipes/routes.ts'

export const routes = routeTable(kitchen, recipes, health)
const app = await createApp({ topology, deployable: 'web', routes, ctx })
```
- A manifest is a route table of its one module (`contracts: [routes.contract]`), so `createApp({ routes })`, `createRouter`, `matchHref`, `renderRoute`, `resumeDocument`, `replay` and `minimize` take one type, and every suite that serves one manifest stays as it is. A route table given to `routeTable` adds its manifests (nesting flattens). A contract is no route table: a type error.
- `routeTable` compiles the union and throws the first E1502 (a shared path pattern across modules, methods aside, D20; or one module twice) or E1509 (k.prefix's rules over the union). `keel check` reads the same rules statically over each deployable's table: the contracts of the modules `topology.ts` lists for it, or every module when there is no `topology.ts`.
- Why a function and not `createApp({ routes: [a, b] })`: the router, the harness and std-sessions take routes too, and one value that each of them takes keeps one shape; an array would be a second shape beside the single manifest.
- Why across-module paths conflict at every method: a 405 answers `allow` with the methods at a path, and two modules at one path would make that answer span modules that ship apart.
- The types were checked in the RFC's prototype (`tsc` 5.9.3): the sample above, `createApp({ routes: kitchen })`, a nested `routeTable(routes, routeTable(app))`, and `routeTable(kitchen.contract)` failing with `@ts-expect-error`.

### 11. Layout chains (D13)
`chainOf` (`packages/router/src/internal/chainOf.ts`) follows `layout` from entry to entry, layouts included, which is how k.router's chains nest today. The binding keeps that: a layout binding takes `layout?` as a page binding does, typed to the contract's layout ids or another module's id.
```ts
export const app = contract('app', { 'app.root': { layout: true }, 'app.settings': { layout: true }, 'app.profile': { path: '/settings/profile' } })
export const routes = manifest(app, {
  'app.root': { component: Root },
  'app.settings': { component: SettingsShell, layout: 'app.root' },
  'app.profile': { component: Profile, layout: 'app.settings' }, // chain: app.root, app.settings, app.profile
})
```
The contract carries no layout name: which layout wraps a page changes no link, no client and no caller, so it is the module's view and not its surface (a caller would break on a layout rename otherwise). A `layout` with the module's own prefix naming a page id or an id the contract lacks, or an id not `<module>.<name>`, is a type error and `manifest` throws E1506; a cycle in the contract passes the type and `manifest` throws E1506 naming both ids. A layout of another module is named by its id, as an app shares one shell layout across feature modules: the binding sees only its own contract, so the type takes own ids as their literal union and a foreign id as template literals whose module prefix is any but the own one (a typo within the own prefix stays a compile error), and `routeTable` resolves it across the union, throwing E1506 naming both ids for an id that names no entry of the table, an entry that is no layout, or a cycle across modules. A manifest whose chain names another module's layout throws E1506 where it is served alone (`createApp`, `createRouter`, `matchHref`, `renderRoute`). The layout's module is in the page module's `deps`, as for any use of another module's entry: `keel check` reports E1152 at the `layout` member otherwise. The own-id cases are checked in the prototype, with the page-id case as `@ts-expect-error`; the foreign id's type in `packages/router/test/foreignLayout.dom.test.ts`.

### 12. Where each code fires (D14)
| code | type error | thrown by | `keel check` |
| --- | --- | --- | --- |
| E1155 | a contract key | | contract keys |
| E1502 | | `contract` (its entries), `routeTable` (across modules; one module twice) | each contract, each deployable's table |
| E1503, E1504, E1653 | | `contract` | the contract literal (E1653 with its fix) |
| E1506 | an own id that is no layout | `manifest` (own ids, a cycle in the contract), `routeTable` (another module's id, a cycle across modules) | |
| E1509 | | `contract`, `routeTable` | each deployable's table |
| E1510 | entry, binding member | `contract`, `manifest` | |
| E1113 | | `contract` (an API `output`), `loader` (a page or layout `output`) | |
| E1513 | | `contract` (an API name) | every case |
| E1514 | | | every case |
| E1515 | every case | `manifest` | |

`action` throws none: a page action answers an `Href` and an API action's `output` is the contract's, so E1113 for an API answer moves from the handler to `contract`. A throw while `keel build` evaluates a contract or `routes.ts` keeps its code (k.compiler). E1113 stays runtime only, as today: it reads a built schema, which the checker does not evaluate.

**How `keel check` codes a type error (D25).** The types are built so that each error lands at the offending node, and the check maps by that node, never by the TypeScript code or message:
- `contract(id, entries)`: `entries` is typed `C & NoInfer<Checked<M, C>>`, where `Checked` is a mapped type keyed by id. A key's member type is its entry's row (API when the literal has `method`, layout when it has `layout`, else page) with each member outside the row typed as a brand, not `never`, so the literal is not reduced and the error is reported at that member; a key without the module prefix maps to a string type, so the error is reported at the key.
- `manifest(contract, binding)`: `binding` is typed `Binding<C>`, a mapped type keyed by id, `{ readonly [K in Ids<C>]: BindingOf<C, K> }`, each member an object type with exactly its kind's row of the binding table (`layout` typed to the contract's layout ids; each handler typed with its id). An entry left unbound is reported at the binding argument, an entry without its required member at its key (so E1515), an extra key at that key, a refused member at that member (an excess property), a handler declared for another id at its member, and a wrong `layout` at `layout`.

The mapping, by the start of the reported error: inside the `entries` argument of a contract file's `contract(...)`, at or under a key without the module prefix E1155, anywhere else E1510. Inside the binding argument of `manifest(...)`: at or under a binding entry's `layout` member E1506; at or under a member that the entry's kind refuses (the kind read from the contract literal; the binding table above) E1510 with its fix, removing the member; anywhere else in the binding argument, the argument itself included, E1515. When the contract literal cannot be read (W1005), a refused member maps to E1515. Elsewhere a type error stays E1751, as a handler `fn` whose answer fails its entry's `output` does. TypeScript may report one fault of an argument and leave another (an extra key goes unreported while a nested member fails); each reported error maps by its own position, and a conformance case holds one fault per call. The prototype's `kitchen/positions.ts` pins each position with a `@ts-expect-error` line directly above the node.

### 13. `surface.json` v2 (D15)
```json
{ "data": { "version": 2,
    "contracts": { "kitchen": { "module": "kitchen", "callers": ["recipes"], "entries": {
      "kitchen.add": { "method": "POST", "path": "/api/recipes", "params": null, "query": null,
        "body": { "type": "object", "properties": { "title": { "type": "string" } }, "required": ["title"] },
        "output": { "type": "object", "properties": {}, "required": [] }, "errors": { "422": { "type": "object" } } } } } },
    "stores": { "kitchen.box": { "state": { "type": "object" }, "transactions": { "kitchen.addRecipe": { "type": "object" } } } },
    "sources": { "modules/kitchen/kitchen.contract.ts": "fnv1a:0498f75b" } },
  "hash": "fnv1a:5c1e09a2" }
```
Keys sorted as every artifact's are; `callers` sorted; an absent `params`, `query` or `body` is `null` and no `errors` is `{}`; `contracts` keyed by module, `entries` by API id; a module with no API entry has no key. `stores` holds each store's state and transaction schemas and `sources` each evaluated file's content hash. This is the layout the conformance writer assumed (`check/conformance/contract-surface-base.test.ts`), with `sources` added.

### 14. The scaffold inputs (D16)
- `keel scaffold route` takes `{ id, path, file?, api?, method? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`, and without `api` it is E1052 (input that fails the operation's schema).
- An API route serving two methods is two entries with two ids, named by hand for the client calls that read best (golden-2's `kitchen.box` and `kitchen.add`, Worked module).

### 15. Stdlib modules over contracts (D18)
std.channels and std.sessions are at their size limit, so the text goes into a new section, std.contracts, now rather than with the package builds, so conformance can be written first.
- **std-sessions** ships `./contract` with `sessions.ingest` (`POST /sessions`, `body: Session`), `sessions.list` (`GET /sessions/list`, `query: ListSearch`) and `sessions.tally` (`GET /sessions/tally`, D31), the last two behind guard `sessions.reader` in the binding. `ListSearch` moves from a `search` to a `query`; a failing one is 422, as Proposal 6 gives every API entry.
- **std-channels**: one call returning entries and binding together cannot work: a contract file imports no `*.server.ts` file (E1514) and `channelRoute` must live in one (E2601). Nor can a helper return the entries for a spread: the kernel reads contracts without running app code (D32), and a spread of a call is unread (E1111, W1005), so a module with a channel would pass neither `keel check` nor the build. So the contract writes the two entries out, naming the channel's own schemas: `{ method: 'GET', path, query: Params, events: true, output: ch.events }` and `{ method: 'POST', path, query: Params, body: ch.body, output: s.object({}) }`, where `channel` makes `events` (the `ChannelEvent` schema of its `message`) and `body` (`s.object({ message })`) once, and `Params` is the schema the channel's `params` names, so E1111 reads it. `channelRoute(contract, channel, { id, publish?, stores, member })` (`./server`) checks each entry's members against the channel by identity (E1515 naming the ones that differ), declares the handlers through the serving module's `contract` as every handler is (D29), its publish action answering `ok({})` (D30), and returns `{ loader, action }`; the binding names them, `'api.boardEvents': { loader: boardEvents.loader }`. The channel is declared in a `*.schema.ts` file so the contract may import it, as `<Name>Api.schema.ts` holds an `endpoints` value (k.openapi). The channel's `params` become the entries' `query`, so a failing one answers 422 instead of 404: the client validates before sending, so only a hand-made request sees it.
- **std-offline**'s `outbox(id, contract)` is in std.offline already; std.contracts adds that `send` names an API write entry by its name after the module, and that the package takes the contract's types from `@keel/router/contract`.

### 16. Where `contract` lives (D19)
`@keel/router`'s root holds `createRouter`, `Form`, `navigate` and their imports of `@keel/runtime-dom` and `@keel/reactive`. A service client in a worker, an outbox, or a page that imports another module's contract only to call it, would pull those in through the contract file's import, and `@keel/services` (thin, 3.5 kB) would need the router as a runtime dependency. So `contract`, its entry types and `Contract` live in a new entry, `@keel/router/contract`, which imports `@keel/schema` only and holds the path compiler and the `href` encoder that `contract` needs; `manifest` and the router import from it. `@keel/router` does not re-export `contract` (one way to import it, PRINCIPLES 1). `@keel/services` and `@keel/std-offline` gain `@keel/router` as a dependency and import types only from `./contract`; both come after `router` in `tooling/deps.json`, so the order in `docs/ARCHITECTURE.md` holds. Size: `@keel/router/contract` gets a budget entry whose number is set from its size measured at the build; `@keel/router` and `@keel/services` are measured at the build and their budgets re-based to the measured numbers (D65), with no byte hunt.

### 17. Stdlib routes and the static reader (D23)
Today `routeLiterals` (`packages/compiler/src/routeLiterals.ts`) reads a `manifest({...})` literal and follows a spread `...x.routes` of a `deps` package into that package's `routes` file; any other spread is W1005. A binding keys only its own contract's ids (E1515), and a `routes.ts` binds its own contract only (E1513), so no `routes.ts` spreads another module's routes and the spread case goes. A stdlib module reaches a deployable as an app module does: `topology.ts` places it, and the generated entries pass its package's `./routes` export to `routeTable` (Proposal 10). The compiler reads it statically from that package's `./contract` and `./routes` files, resolved from the project root through the package's `exports` (where `stdRoutes` resolves `./routes` today); it never reads them from an app file. `routeLiterals` stays, reading each app contract literal (ids, `path`, `method`) and each binding literal (verb keys, `layout`, guard `redirect`); a part of either that is not literal (a computed `path`, a spread, a computed key) is W1005 naming it, and `keel build` writes `routes.json` from evaluation as today.

### 18. Which loaders are live (D24)
k.server says a loader whose `fn` is an async generator is live; k.contract says an `events: true` entry's loader is. They become one rule: a loader is live exactly when its entry is an API GET with `events: true`, and its `fn` is then an async generator. An async generator `fn` declared for a page, a layout or an API GET without `events` is a type error and `manifest` throws E1515, as a plain `fn` on an `events: true` entry is. A page is never live: its document GET renders once, and the client's way to a stream is a `service({ contract })` method of an `events: true` entry (k.services), which a page calls in a scope (std-channels' `subscribe`). No golden app has a live page loader; golden-1's one live loader, `digest.feed`, is an API route. A JSON GET of a live entry answers its first yield, an event-stream GET every yield.

### 19. One path, several methods (D27)
Today `compileRoutes` (`packages/router/src/internal/compileRoutes.ts:47-51`) keeps one id per path pattern and throws E1502 for a second, and `allowOf` builds a 405's `allow` from one route's loader and `routes.actions`. One entry per method needs a second level, so:
- **The key.** The router's table is keyed by path pattern (`patternKey`, as today). A pattern holds either one page, or the API entries of one contract at distinct methods. E1502 is a second entry at a pattern that holds one at its method, or a page and an API entry at one pattern; across modules any shared pattern is E1502, methods aside (D20). A layout has no path and takes no key.
- **Matching.** A request matches a pattern by its path (k.router Matching), then the entry by its method. HEAD is answered by the pattern's GET entry, a page's or an API entry's, as its GET without a body. The guard, loader or action that runs is the matched entry's, and the request's route id in logs is its id.
- **405.** A method no entry at the pattern answers is 405 with no guard run, and `allow` lists the pattern's methods in the order GET, HEAD, POST, PUT, PATCH, DELETE: for a page GET, HEAD and its bound verbs; for API entries their methods, with HEAD after GET when a GET entry is there. A GET to `/api/recipes`'s pattern with only `kitchen.add` bound answers `allow: POST`; with `kitchen.box` too, `allow: GET, HEAD, POST`.
- **OPTIONS** is no entry method. A CORS preflight (OPTIONS with `access-control-request-method`, k.hosting) to an API pattern from an allowed origin is 204 with `access-control-allow-methods` the same list as `allow`; to a page, 405. Any other OPTIONS is 405 with the pattern's `allow`.

## Worked module: golden-2 `kitchen` and its caller `recipes`, before and after

**Before** (today, abridged to what declares the surface):
```ts
// kitchen/routes.ts
export const routes = manifest({
  'kitchen.recipes': { api: true, path: '/api/recipes', loader: loadRecipes },
  'kitchen.favorite': { api: true, path: '/api/recipes/:recipeId/favorite', params: RecipeRef },
  'kitchen.catalog': { api: true, path: '/api/catalog/:locale', params: CatalogParams, search: CatalogSearch, loader: loadCatalog },
  'kitchen.tally.currency': { api: true, path: '/api/tally/currency', loader: loadCurrencyTally },
})
routes.actions({ 'kitchen.recipes': { POST: postRecipe }, 'kitchen.favorite': { POST: postFavorite } })
// kitchen/loadCatalog.server.ts
export const loadCatalog = loader(
  { output: CatalogResult, params: CatalogParams, search: CatalogSearch, stores: boxStores },
  async ({ params, search, stores }, ctx) => { /* ... */ })
// kitchen/postFavorite.server.ts
export const postFavorite = action(
  { input: Nothing, params: RecipeRef, output: Nothing, stores: boxStores }, (_input, { params, stores }) => { /* ... */ })
// kitchen/module.ts: public.routes: ['kitchen.recipes', 'kitchen.favorite', 'kitchen.catalog']
// recipes/kitchen.service.ts: the same four operations again
export const kitchen = endpoints({
  box: { method: 'GET', path: '/api/recipes', output: Box },
  catalog: { method: 'GET', path: '/api/catalog/:locale', params: CatalogParams, query: CatalogSearch, output: CatalogResult },
  add: { method: 'POST', path: '/api/recipes', body: RecipeDraft, output: Nothing, errors: { 422: ErrorReply } },
  favorite: { method: 'POST', path: '/api/recipes/:recipeId/favorite', params: RecipeRef, output: Nothing, errors: { 404: ErrorReply } },
})
// recipes/kitchenApi.ts
export const kitchenApi = service({ module: 'kitchen', schema: kitchen })
// recipes/routes.ts: five page entries, then
routes.actions({ 'recipes.new': { POST: createRecipe }, 'recipes.show': { POST: favoriteRecipe } })
// recipes/createRecipe.server.ts imports ./routes.ts for routes.href('recipes.index', ...)
```

**After:** `kitchen/kitchen.contract.ts` as in Proposal 1 (with `ErrorReply.schema.ts` moved from `recipes` to `kitchen`, whose routes answer it); `kitchen/routes.ts` as in Proposal 2; the five handlers as in Proposal 3:
```ts
// kitchen/loadRecipes.server.ts
export const loadRecipes = loader(kitchen, 'kitchen.box', { stores: boxStores }, async ({ stores }, ctx) => {
  const recipes = stores.box.get('recipes')
  currencyTally(ctx, recipes)
  return ok({ recipes })
})
// kitchen/postFavorite.server.ts
export const postFavorite = action(kitchen, 'kitchen.favorite', { stores: boxStores }, (_body, { params, stores }) => {
  if (!stores.box.get('recipes').some((r) => r.id === params.recipeId))
    return err({ code: 'keel.notFound', message: 'No such recipe', data: null })
  const toggled = tx(stores.toggleFavorite, { recipeId: params.recipeId })
  return toggled.ok ? ok({}) : err(toggled.error)
})
// kitchen/loadCurrencyTally.server.ts
export const loadCurrencyTally = loader(kitchen, 'kitchen.currencyTally', { stores: boxStores }, async ({ stores }, ctx) =>
  ok(currencyTally(ctx, stores.box.get('recipes'))))
// kitchen/module.ts: public.routes removed; public.exports keeps the schemas recipes imports for its own pages
// recipes/recipes.contract.ts
export const recipes = contract('recipes', {
  'recipes.shell': { layout: true },
  'recipes.index': { path: '/:locale', params: LocaleParams, search: RecipeSearch },
  'recipes.catalog': { path: '/:locale/catalog', params: LocaleParams, search: CatalogSearch },
  'recipes.new': { path: '/:locale/recipes/new', params: LocaleParams },
  'recipes.show': { path: '/:locale/recipes/:recipeId', params: RecipeParams },
})
// recipes/kitchenApi.ts (kitchen.service.ts and recipes/ErrorReply.schema.ts are deleted)
export const kitchenApi = service({ contract: kitchen })
// recipes/createRecipe.server.ts: imports the contract, not routes.ts
export const createRecipe = action(recipes, 'recipes.new', { input: RecipeDraft }, async (input, { params }, ctx) => {
  const r = await kitchenApi.add({ body: input }, ctx)
  if (r.ok) return ok(recipes.href('recipes.index', { locale: params.locale }))
  // the 422 keel.fields handling is unchanged
})
// recipes/routes.ts
export const routes = manifest(recipes, {
  'recipes.shell': { component: BoxShell, loader: loadShell },
  'recipes.index': { component: RecipeList, loader: loadIndex, layout: 'recipes.shell', title: (p) => p.data.text.indexTitle },
  'recipes.catalog': { component: CatalogPage, loader: loadCatalog, layout: 'recipes.shell', title: (p) => p.data.text.catalogTitle },
  'recipes.new': { component: NewRecipePage, loader: loadNew, layout: 'recipes.shell', guard: cook, title: (p) => p.data.text.newTitle, POST: createRecipe },
  'recipes.show': {
    component: RecipePage, loader: loadRecipe, layout: 'recipes.shell', errorElement: RecipeError, POST: favoriteRecipe,
    title: (p) => formatMessage(p.data.text.showTitle, { title: p.data.recipe.title }, p.params.locale),
  },
})
```
What changed: the four kitchen operations are declared once instead of twice; `kitchen.recipes` becomes `kitchen.box` and `kitchen.add`, one id per method, and `kitchen.tally.currency` becomes `kitchen.currencyTally`; two `routes.actions` statements, one endpoints file, one error schema and the `public.routes` list are gone; `loadCatalog` and `postFavorite` no longer repeat `params`, `search` or `output`.

**Proof.** The types above were modelled in a prototype of `contract`, `manifest`, `loader`, `action` and `service` (about 230 lines of declarations over the real `@keel/schema` and `@keel/ctx` types) and checked with `tsc` 5.9.3 under `tsconfig.base.json`, importing golden-2's real schema files (`Box`, `CatalogParams`, `CatalogSearch` from `tableSearch`, `CatalogResult` from `tablePage`, `RecipeDraft`, `RecipeRef`, `LocaleParams`, `RecipeParams`, `RecipeSearch`, std-report's `Tally`). The kitchen contract, its five handlers, its binding, the recipes contract with a `POST` action in its entry returning `recipes.href(...)`, and `kitchenApi.box`, `.catalog`, `.add`, `.favorite` calls type-check with no annotation. Each of these is a compile error, checked with `@ts-expect-error`: the binding without `kitchen.currencyTally`; `loadCatalog` bound at `kitchen.box`; a binding key `kitchen.extra`; a `kitchen.box` loader returning `{ recipe: [] }`; a loader for `kitchen.currencyTally` returning the wrong tally shape; `recipes.href('recipes.shell')` (a layout); `recipes.href('recipes.show')` without params; a client method for a page. The prototype is committed at `docs/rfc/0157-prototype/` (`pnpm exec tsc -p docs/rfc/0157-prototype` exits 0): `kitchen/negative.ts` holds the eight wrong uses as `@ts-expect-error` lines, `kitchen/positions.ts` the error positions of Proposal 12, `table/` the route table and layout chains, `chan/` the std-channels spreads. The router build lane starts from it and deletes the folder when the build lands; it sits outside `packages/`, so the structure lint, which scans packages, tooling and evals, does not read its `@ts-expect-error` lines.

## Alternatives
- **Keep two declarations and make E1561 stricter.** Leaves the copy, and the error on the caller's side (Problem 3, 4).
- **Contract for API routes only; pages stay in `manifest({...})`.** Links still come from `routes.ts`, so ADR-0052's cycle stays for pages and `routes.actions` stays for them: two ways to bind an action, which RFC 0086 D2 already declined. It also leaves Problem 5.
- **Serve handlers from the caller's `endpoints` file (RFC 0086 Alternatives).** The schema then lives in the wrong module, and a second caller still writes its own copy.
- **Handlers typed contextually inside the binding.** `'kitchen.box': { loader: loader({}, fn) }` needs no id in the declaration, but a handler lives in its own `*.server.ts` file (E1551, one export per file), where no binding gives it a context. Naming the entry is the price of typing `fn` without annotation.
- **Short keys (`box`) with the module prefix added by `contract`.** Client methods read well either way, since the method name is derived; full ids keep every route id written out in source, where `grep`, `keel codemod rename` and k.module's E1155 already look (principle 3).
- **One `query` word for pages too.** Pages keep `search` because their rule differs (Proposal 6); one word for two behaviours would hide it.
- **An entry per path with verb members (`{ path, GET: {...}, POST: {...} }`).** Keeps one route per path but names client methods `GET` and `POST` under an id, and an endpoint's method moves into a nested object. One entry per method is how `endpoints` already reads, and how ts-rest and OpenAPI operations read.
- **A helper's entries spread into the contract, read by the kernel** (D32). Either the readers evaluate the contract file, which `keel check` cannot do over in-memory sources and which runs app code to learn routes, or they interpret a declared subset of TypeScript in any package's helper, a second language every reader and library author must share. Writing the two entries out costs two lines and keeps each route id, path and method in the source where `grep` and the rules find them.
- **`public.routes` kept beside the contract.** A second list of ids for one surface. A module that wants a route no other module may use keeps it in a module nobody lists in `deps`.

## Spec diff
- **k.contract (new, `proposed`):** Proposal 1 to 4 and 6 to 7 in reference form, with its Conformance list. The kernel map gains a row `| k.contract | Module contract | proposed | entries |`, and its code-range row `E150x` names k.contract as an owner.
- **k.router:** Manifest rewritten over `manifest(contract, binding)` (example and prose), `routes.actions` removed; Links names the contract's `href`; Rules: E1503 and E1504 read the contract, E1505 loses the `routes.actions` cases, E1507 removed; Conformance bullets that named `routes.actions`, `routes.href` and E1507 restated over the contract.
- **k.api:** the entry table moves to k.contract; Requests gains the query step (422); Output reads `output` from the entry; Calling names `service({ contract })`; E1512 removed and E1510 moved to k.contract.
- **k.services:** the API example and `service` options over a contract; `endpoints` scoped to `base`.
- **k.compat:** Surface, Endpoints and Base rewritten over contracts (`version: 2`); E1561 removed.
- **k.module:** `public.routes` removed; Checks read contract imports; E1157 and E1154's route half removed.
- **k.server:** API bullets give the new `loader` and `action` forms.
- **k.topology, k.hosting, k.user, k.boundary, k.compiler, k.forms, k.prefix, k.mount, k.testing, k.scaffold, std.health, std.offline:** `service({ module })` becomes `service({ contract })`, `routes.href` becomes a contract's `href`, `routes.actions` mentions go. No behaviour changes in these sections beyond the names.
- **k.routes (new, `proposed`):** Proposal 10 to 12; the map gains `| k.routes | Route table | proposed | union |`. k.router Manifest and Rules, k.prefix Rules and k.privacy's E1113 point to it.
- **std.contracts (new, `proposed`):** Proposal 15; a row in `spec/std/README.md`. std.channels (`*.schema.ts` channel, 422 for failing params, `channelRoute` returns `{ loader, action }`), std.sessions (`./contract`, `query`) and std.health (its contract, no `public.routes`, E1151-E1156) point to it.
- **k.compiler** Artifacts, Rules and Conformance: Proposal 17 (stdlib routes from `./contract` and `./routes`, W1005 over contract and binding literals); **k.topology** E1558's Conformance over the `loader(contract, id, decl, fn)` shape; **k.server** API and **k.contract** Handlers: Proposal 18; **k.routes** Where rules fire: Proposal 12's reporting rule.
- **k.routes** Union states a route table's and a manifest's public members (D26) and Where rules fire the position mapping (D25); **k.api** Requests gains Paths: the table key, HEAD, 405 and `allow`, OPTIONS (D27); **k.contract** Rules says which E1513 case `contract` throws (D28); **k.contract** Static reading and k.compiler's W1005 state what the readers read (D32).
- **k.compat** Surface gains Proposal 13's layout; **k.scaffold** Proposal 14; **k.services** and **docs/ARCHITECTURE.md** name `@keel/router/contract`; **k.router** Manifest names the server render's ctx (D17); **k.check**'s fixture list reads E1154-E1156; **docs/GLOSSARY.md** gains *route table*.

## Conformance diff
By the `conformance-writer` under `rfc:0157`, from k.contract and the changed sections. Each bullet is checkable from the spec text:
- `contract('a', { 'a.home': { path: '/' } })` returns `kind: 'keel.contract'` and `module: 'a'`; a key `b.home` does not compile; an API id `a.x.y` throws E1513.
- An entry with `method` and `search`, with `layout: true` and `path`, or a page entry with `output`, does not compile, and `contract` throws E1510 for it.
- `manifest(c, binding)` without one of `c`'s entries, or with a key `c` lacks, does not compile and throws E1515 naming the id; with every entry bound it returns a table whose `routes.json` lists every id.
- A loader declared for `a.x` bound at `a.y` does not compile; at runtime `manifest` throws E1515.
- A page action in its entry returning `ok(c.href('a.home'))` compiles with no annotation, and a POST to the page answers 303 to `/` (document) or `ok('/')` (runtime).
- `c.href` of a layout id or an API id does not compile; of a page with params it requires them.
- An API GET entry with `query: s.object({ q: s.string() })` (required) is no E1504; a page entry whose `search` requires a field is E1504.
- A GET to that API entry without `q` answers 422 `keel.fields` with an issue at `query.q` and calls no loader; with a denying guard it answers 403 and the query is not read.
- `service({ contract: c })` has a method per API entry named by the id after the module and none for a page; a call's answer decodes the loader's `ok` value with the entry's `output`, and a 404 `keel.notFound` with `errors[404]`.
- An API loader returning a value that fails the entry's `output` is a compile error, and at runtime (an unchecked caller) E1554 with nothing saved.
- An `events: true` entry bound to a loader whose `fn` is not an async generator throws E1515; with one, the client iterates its yields.
- A contract file importing a `.tsx` component, a `*.server.ts` file or `routes.ts` is one E1514 at the import; importing `*.schema.ts` files and `@keel/std-*` packages is none.
- A `contract` call in `modules/a/routes.ts`, or `contract('b', ...)` in `modules/a/a.contract.ts`, is one E1513 naming `modules/a/a.contract.ts`.
- Module `b` importing `modules/a/a.contract.ts` without `a` in `deps` is one E1152; with it, none, and no E1151 although `a`'s `public.exports` omits the contract.
- `keel build` writes `surface.json` `version: 2` with each contract's API entries and its importing modules; a contract file that throws is one E1006 and exit 1.
- With a base where `a.add`'s `body` is `{ name }` and module `b` in another deployable imports `a`'s contract, adding a required `note` to `body` is one E1562 at `note` whose fix leaves none; with `b` in `a`'s deployable there is none; removing `a.add` is one E1562 with no fix.
- `keel check --base` naming a missing file, or one that is not JSON, is one W1568, no E1562, and exits 0.
- No diagnostic of `keel check` has code E1561, E1507, E1512 or E1157 for any input, and `keel explain E1561` names k.contract.
- `manifest(c, binding)` has `kind` `keel.routeTable`, `contract` `c` and `contracts` `[c]`, and no `routes` member; `routeTable(m)` has no `contract`, and its `contracts` are `[c]` (k.routes).
- In one contract, a GET and a POST entry at `/x` compile and `contract` returns; two POST entries at `/x`, or a page and an API entry at `/x`, throw E1502 naming both ids. With only the POST entry bound, a GET to `/x` is 405 `allow: POST` and runs no guard; with both, a PUT is 405 `allow: GET, HEAD, POST`, a HEAD runs the GET entry's loader and answers no body, and a plain OPTIONS is 405 with the same `allow` (k.api).
- `contract('b', { 'b.home': { path: '/' } })` called from any file returns with no throw; `keel check` reports it in `modules/a/a.contract.ts` as one E1513 (k.contract).
- `keel check` over `contract('a', { 'a.x': { method: 'GET', path: '/x', output: O, search: Q } })` reports one E1510 at `search`; over `{ 'b.home': { path: '/' } }` one E1155 at `b.home`; over a binding with an extra key, one E1515 at that key; over an API binding with a `component`, one E1510 at `component`; none of them E1751 (k.routes).
- k.routes Conformance (route table union, E1502 and E1509 across modules, layout chains and E1506, where E1113 and E1503, E1504, E1653 fire) and std.contracts Conformance, as listed in those sections.
- `keel scaffold route` with `{ id, path, method }` and no `api` is E1052 and writes nothing; with `api: true, method: 'POST'` it adds an API write entry and its binding (k.scaffold).
- `keel check` over a binding whose entry names an unknown `layout`, an API GET entry bound with `action`, and a loader declared for `a.x` bound at `a.y` reports E1506, E1510 and E1515 at those members and no E1751 (k.routes).
- A loader with an async generator `fn` declared for a page entry, or for an API GET without `events`, does not compile, and `manifest` throws E1515 (k.contract); a JSON GET of an `events: true` entry answers its first yield (k.server).
- With `@keel/std-health` placed in `topology.ts`, `keel check` beside the built `routes.json` reports no E1005 and no W1005, reading its routes from the package's `./contract`; an app contract entry whose `path` is computed is one W1005 naming it (k.compiler).
- In a `client` module's `*.server.ts`, `loader(c, 'a.feed', {}, feed)` with `feed` an `async function*` const of the file, `r.loader(c, 'a.x', { output, stores }, fn)` through `import * as r`, and `loader(c, 'a.x', { ...base, output }, fn)` are each one E1558 (k.topology).
- `keel build` writes `data.contracts.<module>` `{ module, callers, entries }`, `params` `null` on an entry without one (k.compat).
- On the server a page component and its loader get the `createApp({ ctx })` object itself (`===`), on every request (k.router). Already holds: `createApp` keeps `opts.ctx` in the served state (`packages/server/src/createApp.ts:180`) and the render passes it (`internal/page.ts:78`); the bullet pins it.
- A page action returning a raw `'//evil.example/x'`, `'/\\evil.example'`, `'https://evil.example/'`, `'javascript:alert(1)'` or `'/a\u0085b'` answers a document POST 500 with no `location`, a JSON POST 500 `{ ok: false, error: { code: 'keel.unexpected', message: 'unexpected', data: {} } }`, and saves no store it changed; `ok(c.href(id))` still answers 303 and `ok(href)` (k.router Links).
- In a client router, a `Form` submit to that action navigates nowhere, starts no document navigation and pushes no history entry, and its `error` slot gets `keel.unexpected`; `navigate` of such a value rejects with E1501 and nothing moves; a `Form` with such an `action` throws E1501; a `Link` with such a `to` renders `href="about:blank"` (k.router Links).
- For generated action results (`null`, `c.href` links, strings from a hostile alphabet), after a submit over each transport the next location (a 303 `location`, a JSON `value`, a client navigation) is `null` or a path of the origin.

Existing suites written over `manifest({...})` are rewritten by the conformance-writer under `rfc:0157`: `cli/conformance/E1561-endpoint-refused.test.ts`, `compat-0092`, `compat-output-0104` and `compat-accepts-property` (over contract entries), `router/conformance/rules-e1501-e1506.test.ts`, the k.api suites of RFC 0086, `check/conformance/fixtures-by-code.ts` and `fix-diffs.test.ts` (E1561, E1157 fixtures go; E1513 to E1515 fixtures come), and every fixture that calls `routes.actions`, `routes.href` or `service({ module })`; std-channels' `contract-entries.test.ts`, `fixtures.ts` and `twoModules.ts` write a channel's entries out and bind `channelRoute`'s `{ loader, action }` (D32).

## Cost
- **Code removed:** `compatChecks.ts`'s endpoint half and its helpers (`endpointAt`, `endpointRefs`, `routeFor`, `samePath`, `routeSchemaAt` in part), `routeActions` and its `WeakMap`, the `compileTable` seal, the `routes.actions` reader of `routeLiterals`, `ActionsFit`, `RouteActions`, the E1157 scan of `service({ module })` calls (`moduleChecks.ts`). **Code added:** `contract`, the binding types (about 230 lines of declarations in the prototype), the contract-literal reader for E1502 to E1504 and E1653, E1513 to E1515, the query step of the server, `surface.json` v2.
- **Use removed:** one `loader` or `action` bound to several routes. A handler is declared for one entry (Proposal 3) and `manifest` refuses it at another (E1515); two routes share logic through a helper both handlers call.
- **Bundles:** `@keel/router` gains `contract` and loses `routes.actions`; `@keel/services` loses the `module` branch of `ServiceOptions` and keeps `moduleTarget`; the server gains the query step. Each is measured at the build and its budget re-based to the measured number (D65); the commit records it.
- **Spec:** k.contract is a new section of about 1,410 tokens, k.routes of about 1,200 and std.contracts of about 1,120; k.router, k.api, k.services, k.compat and k.module each shrink or stay within their limits (`pnpm check` reports each); the map gains two rows (about 23 tokens; 1,234 of 1,250).
- **Budgets:** a new entry `@keel/router/contract`, its number set from the size measured at the build (Proposal 16).
- **Rules:** four codes retired (E1507, E1512, E1561, E1157), three added (E1513 to E1515).

## Build order
1. This RFC, ADR-0179, the spec text (`proposed`). 2. `conformance-writer` under `rfc:0157`, with RFC 0162's suites. 3. Build: router (`contract`, binding, handlers), services, server (query step, live entries), compiler (contract reader, `routes.json`, `surface.json` v2), check (E1513 to E1515, E1562 over contracts, removals), scaffold templates. In the same stage the build lane rewrites the golden apps and the other apps under `apps/`, the stdlib packages (std-health and std-sessions gain `./contract`, std-channels `channel`'s `events` and `body` and `channelRoute`'s `{ loader, action }`, std-offline `outbox(id, contract)`), the fixtures and the published skills (`packages/cli/skills/`) directly to the contract; ADR-0052 is marked superseded by ADR-0179. W1's freeze flip waits for this stage.

## For the operator
1. **Pages in the contract.** D42 says "each endpoint"; this RFC reads it as every route of the module, pages and layouts included, because links derive from the contract and `routes.actions` can go only if `href` leaves the table. Recommendation: accept; the alternative keeps two ways to bind an action.
2. **Full route ids as contract keys** (`'kitchen.box'`) rather than short keys with the prefix added. Recommendation: full ids, as decided above; the client method name is derived either way.
3. **One id per method for API routes.** A path serving GET and POST is two entries, `kitchen.box` and `kitchen.add`, each a route id in logs and `routes.json`. Recommendation: accept; it is what lets a client method and a handler each name one entry.
4. **`public.routes` removed.** Every contract entry is public to modules with the serving module in `deps`. Recommendation: accept; a private route is one no other module lists in `deps`, and the contract is the one list.
5. **E1562 covers API entries only**; a page link built in another deployable from an earlier contract is not compared. Recommendation: leave it; a failing link is a 404 or a dropped search key, and a rule for links is an additive RFC if a real app needs it.
6. **`contract` from `@keel/router/contract` only** (D19). The conformance suites on the lane import it from there. Recommendation: accept; a re-export from the root would be a second way to import it, and the separate entry is what keeps a client of a contract free of the router runtime.
7. **A channel's failing `params` answer 422, not 404** (Proposal 15). Recommendation: accept; they are the entries' `query`, and one rule for every API entry's query is simpler than a channel exception.
