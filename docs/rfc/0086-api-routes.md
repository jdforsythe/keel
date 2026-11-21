# RFC 0086: API routes: a route that answers JSON and has no view

Status: implemented. Accepted (2026-11-11); the user's answers are D1 and D2. Design RFC for backlog 0385, with the context of 0406.

## Decisions (user, 2026-11-11)
- D1: the tagged entry of Proposal 1, with the member `api: true`: "tagged is the right way".
- D2: the user asked whether an API route's actions should sit in the entry, with a verb key implying `api: true`, and was unsure it is worth it. Recorded as not taken (Alternatives, in-entry verbs): actions attach through `routes.actions` for every route. The user may reopen it. RFC 0157 replaces it: `routes.actions` goes and each action binds with its entry in `routes.ts` (D3, D9).

## Problem
A route in a `node` deployable that only answers JSON must still carry a view. Evidence from the code as of this RFC:

1. **`component` is required on every entry, by the type alone.** `packages/router/src/types/RouteDef.ts` declares `component(props, slots?, ctx?): Node` as a non-optional member. `compileRoutes` never reads it and no check rule inspects it.
2. **golden-1 carries five views nobody sees.** `modules/api/routes.ts` has six entries and `modules/digest/routes.ts` three. Their `component`s are `BoardApi`, `SuggestionsApi`, `DigestApi`, `ActionApi` and `RefreshApi`; the last two render the text "POST only". The `web` deployable reaches every one of these routes through `@keel/services`, which sends `accept: application/json`, and `page.ts` returns the loader results before `renderChain` runs. The views render only when a person types the API path into a browser.
3. **std-sessions carries one more.** `packages/std-sessions/src/routes.ts` gives `sessions.ingest` and `sessions.list` the stub `SessionsView`.
4. **The adapter cannot decide.** `apps/sessions` is one `node` deployable whose `ops.home` is a real page beside the two JSON routes, so "a `node` route needs no view" is wrong and the marker has to sit on the route.
5. **An optional `component` is refused.** Operator constraint, 2026-11-11: a page must never lose its `component` by accident. That rules out `component?:` and a structural union in which a page that drops `component` falls into the JSON arm.

## Proposal

### 1. The entry
An API route is a manifest entry that says so with the literal `api: true`.

```ts
export const routes = manifest({
  'api.lists': { api: true, path: '/api/lists', loader: loadBoard },
  'api.todo': { api: true, path: '/api/todos/:todoId', params: TodoIdParams },
  'ops.home': { path: '/', component: Home },
})
routes.actions({ 'api.lists': { POST: postList }, 'api.todo': { PATCH: patchTodo, DELETE: deleteTodo } })
```

`RouteDef` becomes a union of three arms told apart by required members, so no arm is reachable by leaving something out:

| Arm | Requires | Refuses |
| --- | --- | --- |
| page | `path`, `component` | `api` |
| layout | `component`, no `path` | `api` |
| API route | `api: true`, `path` | `component`, `errorElement`, `title`, `layout` |

An entry with neither `component` nor `api: true` matches no arm: it does not compile, and `manifest()` throws E1510 for a caller the type did not stop. An API route keeps `params`, `search`, `loader` and `guard`, and takes its actions through `routes.actions` as every route does. It must have a loader or an action (E1510).

The entry stays in the module's one `routes` export, so the generated entry, `...x.routes` spreads of a `deps` package, E1502 and E1559 path checks, and `routes.json` all read one table. `routes.json` entries gain `api: true`.

### 2. What the server does with one
An API route is answered as a runtime request whatever `accept` says:

- GET with a loader: the same JSON body a runtime GET of a page gets today (`{ id, results }`), with the loader's status. No HTML is rendered and nothing is an island root.
- GET without a loader: 405 with `allow` listing its action methods.
- GET with `accept: text/event-stream` on a live loader: unchanged.
- A write: the same-site check, then the action's `Result` as JSON. It never answers 303.
- A guard denial: 403 `keel.denied` as JSON. The guard's `redirect` is not followed, since a JSON caller cannot use a login page.
- Every error status of k.server's table, as the `Result` JSON.

The wire format of a `@keel/services` call does not change, so E1561 and E1562 keep reading the loader and action schemas.

### 3. What the router does with one
`routes.href(id)` accepts page ids only, so `Link to`, `navigate`, `Form action` and a guard's `redirect` cannot name an API route; the id fails to compile as a layout id does. `matchHref` returns `null` for an API path and the client router does not match one, so a same-origin link to it is a document request. Other modules call an API route through `service({ module })`, which is the one way to call it.

### 4. Rules
- E1510 (k.router): an `api: true` entry with `component`, `errorElement`, `title` or `layout`, or without `path`, or with neither a loader nor an action; an entry with neither `component` nor `api: true`. Type error where the literal is checked, thrown by `manifest()` otherwise. Fix diff: none for a missing `component` (the checker cannot know which arm was meant); for an API entry with a view member, the fix removes the member.
- E1511 (k.topology): an API route in a module a `client` or `static` deployable serves. Those deployables have no server to answer it. Reported by the checker from `topology.ts` and thrown by `createApp` beside E1553 and E1558.

### 5. Scaffold
`keel scaffold route <id> --api` writes an API entry and its `*.server.ts` loader or action with no component file. The `module` and `project` templates for a `node` API module use it.

## Alternatives
- **Optional `component`.** Refused by the user constraint in Problem 5.
- **A separate declaration, `export const api = endpoints({...})` beside `routes`.** A module such as `ops` in `apps/sessions` would export two tables, and the generated entry, the fragment spread of RFC 0077, the E1502 and E1559 path checks, k.module's `public.routes` and `routes.json` would each learn a second source. The name `endpoints` is also taken by `@keel/services`. It buys the same guarantee as the `api: true` arm at the cost of a second way to declare a path.
- **A wrapper call, `'api.lists': endpoint({ path, loader })`.** The compiler reads `routes.ts` literals statically (RFC 0059); a call per entry needs a new case in that reader, and a literal member does not.
- **A sentinel view, `component: json`.** One type and no union, but it spells "no view" as a view, which is the thing the user direction separates.
- **Serve handlers from the `@keel/services` `endpoints` schema.** The API module would own `Api.schema.ts`, handlers would be typed from it, and E1561 and E1562 would have nothing left to compare. It is the fullest form of "an API is its own thing" and of principle 4. It replaces `loader` and `action` for JSON, changes every golden app's server module and the `Href | null` action result, and is a stage of its own. This RFC does not block it: `api: true` entries are the set such a change would later rewrite.
- **In-entry verbs, `'api.lists': { path, GET: loadBoard, POST: postList }`, the verb key standing for `api: true`.** It reads like an API and needs no tag. Three costs. In-entry actions were removed by ADR-0052 because an action returning `ok(routes.href(...))` makes the manifest's initializer circular (TS7022); API actions in golden-1 all return `ok(null)`, but one that redirects to a page would bring the error back. Pages would attach actions with `routes.actions` and API routes in the entry: two ways to bind an action, and E1505 with an exception. And a GET-only API route has no verb key unless `loader` is also renamed `GET` there, so the tag would still be needed or the loader would have two names.
- **Decide by adapter.** Wrong for `apps/sessions` (Problem 4).

## Spec diff
All four sections touched are at or within 6 tokens of the 1,500 token limit, so the route kinds get a section of their own.
- **k.api (new, `proposed`)**: the entry arms of Proposal 1, the request flow of Proposal 2, `href` and matching of Proposal 3, E1510, and the conformance clauses below.
- **k.router** Manifest: "An entry without `path` is a layout" gains "; one with `api: true` is an API route (k.api)". Offset by rewording in the same paragraph with no change in meaning.
- **k.topology** Rules: adds "E1511 an API route in a `client` or `static` deployable". Offset by rewording.
- **k.server**, **k.services**: no text change.

## Conformance diff
New files only, written by the conformance-writer from k.api under `rfc:0086`:
- `packages/router/conformance/api-routes-0086.test.ts`: an entry with neither `component` nor `api: true` does not compile and throws E1510; an API entry with `component` is E1510; `routes.href` of an API id does not compile; `matchHref` of an API path is `null`; E1510 has a triggering fixture and a clean one.
- `packages/server/conformance/api-routes-0086.test.ts`: a GET with `accept: text/html` to an API route gets the JSON a runtime GET gets; a GET to an API route without a loader is 405 with `allow`; a form POST gets `Result` JSON and no `Location`; a denying guard is 403 with no redirect; `createApp` for a `client` deployable serving an API route throws E1511.

An existing conformance fixture that carries a stub view for a JSON route keeps it: a page answering a runtime GET is still specified behavior.

## Migration
- golden-1: the six `api` entries and three `digest` entries become API routes; `BoardApi`, `SuggestionsApi`, `DigestApi`, `ActionApi` and `RefreshApi` are deleted.
- std-sessions: `sessions.ingest` and `sessions.list` become API routes; `SessionsView` is deleted. `apps/sessions` keeps `ops.home`.
- `docs/guide/build-golden-1.md`, the `keel-api` skill and the scaffold templates stop writing stub views.
- An app outside this repo with a JSON-only route keeps working unchanged until it adds `api: true` and drops the view. A route that people open in a browser and services also call stays a page.

## Token impact
k.api is about 450 tokens. k.router and k.topology stay at their current counts by rewording. The `@keel/server` bundle is 20 bytes under its budget (16,364 B of 16,384 B), so the request-flow branch needs a re-base with the reason in the commit, or the trim of backlog 0391 first.
