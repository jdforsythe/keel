# k.routes: Route table
status: conformance-covered

**Union.** A deployable serves one route table, the union of its modules' manifests (k.contract Binding), made by `routeTable(...tables)` from `@keel/router`:
```ts
import { routeTable } from '@keel/router'
import { routes as health } from '@keel/std-health/routes'
import { routes as kitchen } from './modules/kitchen/routes.ts'
import { routes as recipes } from './modules/recipes/routes.ts'

export const routes = routeTable(kitchen, recipes, health)
```
`routeTable` returns a frozen `{ kind: 'keel.routeTable', contracts }`, the contracts in argument order; a route table given to it adds its contracts. A manifest is the route table of its one module, `{ kind: 'keel.routeTable', contract, contracts: [contract] }`. A table's bindings are no public member; its ids, paths, methods and schemas are its contracts' `entries`. Whatever takes routes takes either: `createApp`, `createRouter`, `matchHref`, `renderRoute` and `resumeDocument`, std-sessions' `replay` and `minimize`. A contract is no route table (a type error). Argument order changes no answer (k.router Matching). The generated entries call `routeTable` over the `routes` of the deployable's modules in `topology.ts` order: an app module's `routes.ts`, a stdlib module's `./routes` export.

**Layouts.** A page or layout binding names the layout it renders in with `layout`, a layout id of its contract or of another module's, so a chain nests to any depth, outermost first:
```ts
export const routes = manifest(app, {
  'app.root': { component: Root },
  'app.settings': { component: SettingsShell, layout: 'app.root' },
  'app.profile': { component: Profile, layout: 'app.settings' }, // chain: app.root, app.settings, app.profile
})
```
An id of the own module that is no layout of the contract, or one not `<module>.<name>`, is a type error and `manifest` throws E1506, as for a cycle in it. Another module's id compiles; `routeTable`, or a manifest served alone, throws E1506 naming both ids if it names no layout entry of the table or closes a cycle. `deps` must list its module (`keel check` E1152 at `layout`). A layout no binding names is no error.

**Where rules fire.** A code is a type error, a throw, a `keel check` diagnostic, or several. `keel check` codes a type error by the node where it starts, whatever its TS code, when that node is the argument, a key, or a member's literal or name value: in a contract file's `contract` entries, a key without the module prefix E1155, else E1510; in a `manifest` binding, an entry's `layout` E1506, a member the entry's kind refuses E1510 with its fix, else E1515. Inside a function or call (a `title` body, a schema) it is E1751 with its own text, under an unprefixed key too. The types are mapped types keyed by id, so an unbound entry starts at the argument, an extra key at the key, a wrong member at the member. Each reported error maps alone. A throw while `keel build` evaluates a contract or `routes.ts` keeps its code (k.compiler).

| code | type error | thrown by | `keel check` |
| --- | --- | --- | --- |
| E1155 | a contract key | `contract` | contract keys |
| E1502 | | `contract` (its entries), `routeTable` (across modules; one module twice) | each contract, each deployable's table |
| E1503, E1504, E1653 | | `contract` | the contract literal (E1653 with its fix) |
| E1506 | an own id no layout | `manifest` (own ids), `routeTable` (union) | |
| E1509 | | `contract`, `routeTable` (the union) | each deployable's table |
| E1510 | entry, binding member | `contract`, `manifest` | |
| E1113 | | `contract` (an API `output`), `loader` (a page or layout `output`) | |
| E1513 | | `contract` (an API name only) | every case |
| E1514 | | | every case |
| E1515 | every case | `manifest` | |

`action` throws none. Across modules any shared path pattern is E1502, methods aside: a path's 405 `allow` lists one module's entries. A deployable's table in `keel check` is the contracts of the modules `topology.ts` gives it (an app module's contract file, a stdlib module's `./contract`); with no `topology.ts`, the project's modules form one. E1559 (k.topology) compares the deployables' tables.

**Conformance.**
- `createApp` serving `routeTable(a, b)` of two modules' manifests answers a route of each; `routeTable(routeTable(a), b)` and `routeTable(b, a)` answer every request alike, and `createApp({ routes: a })` as `routeTable(a)` does.
- `routeTable(a, b)` where `b` has a page on the path pattern of a page of `a`, or of an API entry of `a` at another method, throws E1502 naming both ids; `routeTable(a, a)` throws E1502 naming `a`.
- With `a` holding a prefixed route (k.prefix) and `b` a page at `/de-DE/about`, `routeTable(a, b)` throws E1509, and `keel check` with `a` and `b` in one deployable reports one E1509 at `b`'s `path`; in two deployables, none.
- `routeTable(c)` of a contract does not compile.
- `keel check` over a binding with an unknown `layout`, an API GET entry bound with `action`, and a loader declared for `a.x` bound at `a.y` reports one E1506, one E1510 and one E1515 at those members, and no E1751; over an entry with `method` and `search`, one E1510 at `search`; over a key `b.home` in module `a`, one E1155 at the key; over an extra binding key, one E1515 at it.
- `manifest(c, b)` has `kind` `keel.routeTable`, `contract` `c`, `contracts` `[c]` and no `routes`; `routeTable(m)` has no `contract`.
- A page bound with `layout: 'a.inner'`, `a.inner` with `layout: 'a.outer'`, renders inside `a.inner`'s component, inside `a.outer`'s.
- A `layout` naming a page id does not compile and `manifest` throws E1506; two layouts naming each other make `manifest` throw E1506 naming both.
- `contract` throws E1503, E1504, E1653 and E1113 for an entry breaking each, and `keel check` reports E1503, E1504 and E1653 from the same contract file and no E1113; `loader` throws E1113 for a page loader whose `output` holds an `s.secret`; `action` throws none of these codes.
