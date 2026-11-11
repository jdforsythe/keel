# k.api: API routes
status: proposed

**Purpose.** A route that answers JSON has no view. It is declared in the module's one manifest (k.router), marked so no page can lose its view by omission.

**Entry.** An entry of `manifest()` is one of three kinds, told apart by required members:

| Kind | Requires | Refuses |
| --- | --- | --- |
| page | `path`, `component` | `api` |
| layout | `component`, no `path` | `api` |
| API route | `api: true`, `path` | `component`, `errorElement`, `title`, `layout` |

```ts
export const routes = manifest({
  'api.lists': { api: true, path: '/api/lists', loader: loadBoard },
  'ops.home': { path: '/', component: Home },
})
routes.actions({ 'api.lists': { POST: postList } })
```
An API route keeps `params`, `search`, `loader` and `guard`, takes its actions through `routes.actions`, and has a loader or an action. In `routes.json` its entry has `api: true`.

**Requests.** The server answers an API route as a runtime request (k.server) whatever `accept` says; it renders no HTML and is no island root.
- GET with a loader: `{ id, results }` as JSON with the loader's status. With `accept: text/event-stream` on a live loader: the stream.
- GET without a loader: 405 with `allow` listing its action methods.
- A write: the same-site check, then the action's `Result` as JSON; never 303.
- A guard denial: 403 `keel.denied` as JSON; the guard's `redirect` is not followed.
- Every error status of k.server, as the `Result` JSON.

**Calling.** `routes.href` takes page ids only, so `Link`, `navigate`, `Form action` and a guard's `redirect` cannot name an API route. `matchHref` returns `null` for an API route's path and the client router matches none, so a link to one is a document request. Modules call an API route through `service({ module })` (k.services).

**Rules.** E1510 an entry with neither `component` nor `api: true`; an API route with `component`, `errorElement`, `title` or `layout`, without `path`, or with neither a loader nor an action. A type error where the literal is checked; `manifest()` throws it for the entry, `routes.actions` or the first read of the table for a missing loader and action. Fix: remove the refused member; none for a missing `component` · E1511 an API route in a module a `client` or `static` deployable serves (k.topology); reported from `topology.ts`, thrown by `createApp`; no fix.

**Conformance.**
- An entry with neither `component` nor `api: true` does not compile, and `manifest()` throws E1510 for it.
- An API entry with `component` does not compile and throws E1510.
- `routes.href` of an API route's id does not compile; `matchHref` of its path is `null`.
- E1510 has a triggering fixture and a clean one.
- A GET with `accept: text/html` to an API route with a loader gets the JSON body and status a runtime GET gets.
- A GET to an API route without a loader is 405 with `allow` listing its action methods.
- A form POST to an API route gets the action's `Result` as JSON with no `Location`.
- A denying guard with a `redirect` answers 403 `keel.denied` and no `Location`.
- `createApp` for a `client` deployable serving an API route throws E1511.
