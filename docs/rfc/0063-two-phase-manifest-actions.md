# RFC 0063: actions attach with `routes.actions`, so an action can return `ok(routes.href(...))`

Status: accepted (ADR-0052)

## Problem
Backlog 0114 (decided 2026-11-07, D8 in tasks/0034-freeze). A route entry held its actions (`actions: { POST: save }`), so the type of `routes` depended on the type of each action. An action that links into its own manifest reads `routes`. With `return ok(routes.href(...))` its return type depends on `routes`, whose initializer depends on the action: TypeScript reports TS7022 (implicit `any` from a circular initializer). RFC 0041 and RFC 0045 kept a workaround: bind `const to: Href = routes.href(...)` first, then `return ok(to)`. That is a second way to write a redirect, taught by the skills and copied into both golden apps and the evals.

## Proposal
A two-phase manifest. Phase 1 is `manifest({...})`: paths, schemas, loaders, guards, layouts, components; it exposes `href`. Phase 2 is a statement after it:

```ts
export const routes = manifest({
  'orders.show': { path: '/orders/:id', params: OrderParams, loader: loadOrder, component: OrderPage },
})
routes.actions({ 'orders.show': { POST: updateOrder, DELETE: removeOrder } })
```

- `routes.actions(byId)` returns `void`, so the attachment is never part of an initializer and no type depends on it. `updateOrder` may `return ok(routes.href('orders.list'))` with no annotation.
- Types: each key is an id of a route with a `path`; each method key is a `Verb`; each action's `params` accepts `Infer` of the route's `params` (`ActionsFit`). A key or action that does not fit does not compile, with a message.
- Runtime: `routes.actions` validates the whole argument, then attaches. E1505: an unknown or layout id, a key that is not `POST`/`PUT`/`PATCH`/`DELETE`, or a route that already has actions. E1507: an action `params` schema that is not the route's own value.
- An entry that still has `actions` does not compile (`RouteFit` names the move) and `manifest` throws E1505: `<id>: move actions to routes.actions({ "<id>": {...} }) after the manifest`.
- Actions are kept per route entry object (`routeActions`, a `WeakMap` in `@keel/router/internal`). A deployable's union manifest, built from `{ ...a.routes, ...b.routes }`, therefore keeps them with no change to the generated entry. The client router, the server's dispatch by verb (405 `allow` lists attached verbs), E1553, and `routesArtifact` read from it. `routes.json` keeps its shape.
- `routeLiterals` (keel check, rfc:0059) reads verbs from `<manifest>.actions({...})` calls anywhere in the manifest file, where the receiver is `routes` or a `const` alias of it. An `actions` key in an entry, a non-literal argument or value, `actions` read by a computed key or without a call, or a project file that reads `actions` off a binding imported from the manifest file, unreads the actions (W1005 by name) rather than reading them as none (backlog 0183).
- `compileTable`, which `createRouter` and `createApp` call, seals the entries it compiles: a later `routes.actions` on them throws E1505 (`actions attached after createApp or createRouter`). So the E1553 check at `createApp` holds for the life of the server, and dispatch needs no re-check and no server bytes (backlog 0183).

## Alternatives
- Re-check E1553 at dispatch (backlog 0183). Costs server bytes on every write and still lets the attached set change under a running router.
- Keep `const to: Href` (RFC 0045). One line per redirect, but two ways to write one, and the skills must teach it.
- `manifest({...}).actions({...})` returning the manifest. The call is still in the initializer, so the cycle returns.
- A callback `manifest(routes, (r) => actions)`. The callback is checked while `routes` is resolved; same cycle.
- `export const actions = routes.actions({...})` passed to `createApp` and `createRouter`. A second value to wire into every entry, the union, and the tests.
- Annotate every action's return type. Restates the `Result` type in each action (principle 4).

## Spec diff
k.router: Manifest example moves `actions` to `routes.actions(...)`, plus one sentence; E1505 covers an entry with `actions` and `routes.actions` keys; E1507 names the throw generally; Conformance +1, appended last so existing clause numbers keep their ledger rungs ("An action returning `ok(routes.href(id))` compiles unannotated and navigates to `id`; an entry with `actions` throws E1505."). Non-normative words trimmed (rfc reference, "not a name", a duplicated union clause, the router-minted key). k.server: the `action` bullet says a route gets it by method from `routes.actions`; the rfc references in two headings are dropped.

## Conformance diff
Added: router `action-returns-href.test.ts`: two in-memory modules (`routes.ts` importing the action, the action importing `routes`) type-check with no TS7022/7023/7024; the old in-entry shape, an unknown id and a `GET` key do not compile; a Form whose action returns `ok(routes.href('n.list'))` lands on `n.list`; two fast-check properties (seed 1337): for any generated table, verb and target a Form lands on the target, and an entry with `actions` under any verb throws E1505. Tests (not conformance): router `manifest.test.ts` E1505 after `createRouter`; server `lateActions.test.ts` (E1505 after `createApp`, the static POST stays 405); compiler `routeLiterals.test.ts` alias, block, other-file, namespace, computed and uncalled reads. Changed under rfc:0063 (shape only): router `fixtures.ts` (actions attach after the manifest; `act` returns `ok(routes.href(...))`), `rules-e1501-e1506.test.ts` (E1505 keys through `routes.actions`, plus the in-entry case), `loader-params-inferred.test.ts` (action E1507 through `routes.actions`); server `fixtures.ts`, `body-cap-413`, `caller-cookie-host-prefix`, `caller-token-signed`, `read-set-conflict`, `server-state-instances`; forms `fixtures.ts`.

## Migration
Before:
```ts
export const routes = manifest({
  'todos.edit': { path: '/lists/:listId/todos/:todoId/edit', params: TodoParams, actions: { POST: updateTodo }, component: EditTodoPage },
})
// updateTodo.server.ts
const to: Href = routes.href('todos.list', { listId: params.listId })
return ok(to)
```
After:
```ts
export const routes = manifest({
  'todos.edit': { path: '/lists/:listId/todos/:todoId/edit', params: TodoParams, component: EditTodoPage },
})
routes.actions({ 'todos.edit': { POST: updateTodo } })
// updateTodo.server.ts
return ok(routes.href('todos.list', { listId: params.listId }))
```
Every manifest with actions moves: golden-1 (`todos`, `api`), golden-2 (`recipes`, `kitchen`), router/server/forms/testing tests and fixtures, compiler `routeLiterals` tests. The `const to: Href` binding is gone from both apps, the fixtures, and the keel, keel-api and keel-forms skills; the eval spec slices show `routes.actions` and `ok(routes.href(...))`. The inspector and scaffold templates declare no actions. A component that returns `Form(...)` directly and is held by its own manifest still needs a return type (RFC 0045); JSX `<Form>` does not.

## Token impact
k.router 1,493 -> 1,498; k.server 1,502 -> 1,500. Both within 1,500.
