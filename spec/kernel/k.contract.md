# k.contract: Module contract
status: conformance-covered

**Contract.** Each route a module serves is declared once in `modules/<id>/<id>.contract.ts` (a stdlib package's: its `./contract` export), whose one export `<id>` is `contract('<id>', entries)` from `@keel/router/contract`, an entry that imports `@keel/schema` only:
```ts
export const kitchen = contract('kitchen', {
  'kitchen.shell': { layout: true },
  'kitchen.home': { path: '/kitchen', search: HomeSearch },
  'kitchen.box': { method: 'GET', path: '/api/recipes', output: Box },
  'kitchen.add': { method: 'POST', path: '/api/recipes', body: RecipeDraft, output: Nothing },
})
```
It is client-safe (E1514); keys are route ids prefixed by the module id (E1155). An entry is one kind, told apart by required members:

| Kind | Requires | Optional |
| --- | --- | --- |
| page | `path` | `params`, `search`, `local` |
| layout | `layout: true` | |
| API | `method`, `path`, `output` | `params`, `query`, `body`, `errors`, `timeout`, `events`, `local` |

A kind refuses members outside its row. `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; an API id is `<module>.<name>`, `name` one lowerCamel segment.

**Static reading.** Keys are literal; the entries and each entry are object literals in the call, `method`, `path`, `layout` and `events` literals, `params`, `search` and `query` schemas read through consts and imports, other members any expression. A spread, call or name there (a const object's too) is W1005 and E1111 at it; the entries beside it are read.

**Binding.** `routes.ts` exports `routes = manifest(contract, binding)`, binding every entry and nothing else: a page `{ component, loader?, guard?, layout?, errorElement?, title?, POST?, PUT?, PATCH?, DELETE? }` (verbs: page actions); a layout `{ component, loader?, guard?, layout?, errorElement? }`; an API GET `{ loader, guard? }`; an API write `{ action, guard? }`. `layout` names a layout of any module (k.routes); page and layout guards have a `redirect` (k.guards).

**Handlers.** A handler names its entry; `fn` is never annotated:
- `loader(contract, id, decl, fn)`: `fn` gets `{ params, search, url, caller, user, bearer, stores, signal }` and `ctx` (k.server). `params` is `Infer` of the entry's `params` (`{}` without), `search` of a page's `search` or an API entry's `query`; a layout's `params` are the matched route's, `unknown`. On an API GET `decl` is `{ stores? }` and `fn` returns `Result` of `output`, as an async generator when `events: true` (live, k.server, whose `fn` also gets `currentUser`), and only then: no page or layout loader is live. On a page or layout `decl` is `{ output, stores? }`.
- `action(contract, id, decl, fn)`: on an API write `decl` is `{ stores? }` and `fn` gets the decoded `body` (`{}` without one), `{ params, url, caller, user, bearer, stores }` and `ctx` and returns `Result` of `output` (k.api Output). On a page `decl` is `{ input, stores? }` and `fn` returns `Result<Href | null>` (k.router Form); its verb is its binding key.

**Derived.** `<contract>.href(id, params?, search?)` links to a page of it (k.router Links). `service({ contract, timeout? })` (k.services) has a method per API entry. `routes.json` and `surface.json` (k.compat) derive from both. Every entry is public to a module whose `deps` name this one; importing the contract needs `deps` only (E1152), never `public.exports`.

**Local routes.** `local: true` on a page or API entry makes it a route of this machine alone, for a dev tool (the inspector). Before guards, loaders or actions run, the server answers a request its own matcher matches to it only when four things hold: the connection's remote address is a loopback address (`127.0.0.1`, `::1`, IPv4-mapped `::ffff:127.0.0.1`); its `Host` is `localhost`, `127.0.0.1` or `[::1]` with a port; its `Sec-Fetch-Site` is `same-origin` or `none`; and it carries no `x-keel-forwarded`, any value (k.topology Calls and peers: each forwarded request and each a server's `service` call sends has it). Any other request, one without `Sec-Fetch-Site` too, is 403 `keel.denied` and runs nothing. A request in absolute form (`GET http://host/path`) is judged by its authority, not `Host` (RFC 9112): a foreign one is refused whatever `Host` says. `createApp`'s `fetch(request, connection?)` reads the remote address from `connection.incoming.socket.remoteAddress`, the shape `@hono/node-server` passes; `server.mjs` and `keel dev` pass each request's own, and no forwarding header (`X-Forwarded-For`, `Forwarded`) is read, whatever the proxy setting. A `fetch` with no connection (a harness, k.testing) has no remote address and is refused. A request to `server.mjs` with no `Host` (HTTP/1.0) or an empty one in any HTTP version, more than one, or one it cannot read as a host and optional port (`a b`, `[::1`, `127.0.0.1 :9100`, port 0, where no server listens) or reads back changed (`[::ffff:127.0.0.1]:<port>`), is 403 `keel.denied` on any route, never 400. Every refusal here carries the k.security headers. `x-keel-forwarded` grants nothing: sent by a client, it is refused on `local` routes alone. A proxy outside Keel on this machine forwarding with a loopback `Host` makes the route reachable through it, so no `local` route is deployed behind one (the operator's call). `local` guards a route from clients and Keel's relays, not the app's own server code: its loopback `ctx.net.fetch` (in `unsafe`) with headers it sets is a tool on this machine and reaches a peer's `local` route. `local` gates server work (loader, action, guard, API handler) and the served document; a `local` page's component ships in the client assets like any page's, so nothing private belongs in its text. `local: true` on an entry of a module a `client` or `static` deployable serves is E1511 (k.api): no server there enforces it. `.keel/routes.json` marks the entry `local: true`, so the surface shows it. A loader reads no request header (`fn` gets the members Binding lists); `local` is the one declared way to judge a request's source. `local` other than the literal `true` (`false`, `!0`, a name bound to `true`, a conditional) is E1510 at the member in `keel check` and `keel build`, and the failed build removes the serving deployable's `dist/<name>/` (k.api Rules).

**Rules.** E1510 an entry of no kind or with a member its kind refuses, or a binding member its entry refuses; a type error, thrown by `contract` or `manifest`; fix removes the member, none for an entry missing one · E1513 a `contract()` call outside `modules/<id>/<id>.contract.ts` or a package's `./contract`, a second one, an `id` not the folder's module id, an export not named `<id>`, a `routes.ts` binding another module's contract, `contract` reached but by a direct call of its import (an alias, a re-export), or an API id with a dotted name; `contract` throws the last alone; no fix, the message names the expected path · E1514 a contract file importing anything but a `*.schema.ts` file or a package, at the import; no fix · E1515 a binding missing an entry or an entry's required member, with a key the contract lacks, with a handler declared for another id or contract, with a plain loader on an `events: true` entry, or with an async generator loader on any other; a type error, `manifest` throws it naming the id; fix removes an extra key · E1511 (k.api) a `local` entry outside a `node` deployable. E1502, E1503, E1504 (k.router) and E1653 (k.services) read the contract. Where each code fires: k.routes.

**Conformance.**
- `contract('a', { 'a.home': { path: '/' } })` has `kind` `keel.contract` and `module` `a`; a key `b.home` does not compile; an API id `a.x.y` throws E1513.
- An entry with `method` and `search`, with `layout: true` and `path`, or a page with `output` does not compile, and `contract` throws E1510.
- `manifest(c, binding)` missing an entry of `c`, or with a key `c` lacks, does not compile and throws E1515 naming the id.
- A loader declared for `a.x` bound at `a.y` does not compile and `manifest` throws E1515.
- A page action in its entry returning `ok(c.href('a.home'))` compiles unannotated; its document POST answers 303 to `/`.
- `c.href` of a layout or API id does not compile; of a page with params it requires them.
- `service({ contract: c })` has a method per API entry named by the id after the module, none for a page.
- An `events: true` entry bound to a plain loader throws E1515; an async generator loader declared for a page, or an API GET without `events`, does not compile and `manifest` throws E1515.
- A contract file importing a `.tsx` component, a `*.server.ts` file or `routes.ts` is one E1514; importing `*.schema.ts` files and `@keel/std-*` packages is none.
- `contract` in `modules/a/routes.ts`, or `contract('b', ...)` in `modules/a/a.contract.ts`, is one E1513 naming `modules/a/a.contract.ts`; called, `contract('b', ...)` throws none.
- Module `b` importing `modules/a/a.contract.ts` without `a` in `deps` is one E1152; with it none, and no E1151.
- A `GET` of a `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none` answers the page, and its loader runs once.
- The same `GET` with `Sec-Fetch-Site: cross-site`, with no `Sec-Fetch-Site`, or with `Host: example.com`, answers 403 `keel.denied` and its loader does not run.
- A `GET` of that page over a connection from a non-loopback address of the machine, with `Host: localhost:<port>` and `Sec-Fetch-Site: same-origin`, answers 403 `keel.denied`.
- `.keel/routes.json` of a contract with a `local: true` API entry marks that entry `local: true`; `local: false` on an entry is E1510.
- `fetch` of that `GET` with `Host: 127.0.0.1:<port>`, `Sec-Fetch-Site: none` and a connection whose remote address is `::ffff:127.0.0.1` answers the page; with remote address `10.0.0.5` and `X-Forwarded-For: 127.0.0.1` it answers 403 `keel.denied`.
- A loader's `fn` argument has exactly the keys `params`, `search`, `url`, `caller`, `user`, `bearer`, `stores` and `signal`.
- `server.mjs` of a `keel build` fixture answers an HTTP/1.0 `GET /` with no `Host`, a `GET /` with `Host: [::ffff:127.0.0.1]:<port>`, and a `GET` of its `local: true` page from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: cross-site`, each 403 `keel.denied` carrying the six k.security headers.
- `server.mjs` of a `keel build` fixture answers an HTTP/1.1 `GET /` with no `Host` header and a `GET /` with an empty `Host:`, each 403 `keel.denied` carrying the six k.security headers.
- In a fixture whose `client` deployable `web` serves module `a` with a `local: true` page `a.tools`, `keel check` and `keel build` each report one E1511 `a.tools: local route in client deployable web, which has no server` at `topology.ts`, `keel build` exits 1 and writes no `dist/web/`, and `createApp` for `web` throws E1511; with `web` a `static` deployable, one E1511 `a.tools: local route in static deployable web, which has no server`; with `a` served by a `node` deployable, none.
- `server.mjs` of a `keel build` fixture answers a `GET /` with `Host: a b`, with `Host: [::1`, with `Host: 127.0.0.1 :<port>`, and with two `Host: 127.0.0.1:<port>` headers, each 403 `keel.denied` carrying the six k.security headers.
- In a fixture whose `node` deployable `api` serves module `a`, `local: !0`, `local: on` with `const on = true`, and `local: flag ? true : true` on page `a.tools` are each one E1510 at `local` in `keel check` and in `keel build`; after a `keel build` that succeeds, one that then fails with that E1510 leaves no `dist/api/`, and one that fails with the E1511 above no `dist/web/`.
- `ctx.net.fetch` of `y`'s `local: true` page at `http://127.0.0.1:<port>/tools` with `Sec-Fetch-Site: none`, from `unsafe` code in a loader of `x`, both `server.mjs`, gets 200; `y`'s loader runs once.
- With `api` serving `local: true` page `a.tools`, its component's text `comp-canary` and its loader's `load-canary`, `keel build` writes `comp-canary` and no `load-canary` under `dist/api/assets/`; a `GET` from remote address `10.0.0.5` is 403 `keel.denied`, holding neither.
- `server.mjs` answers `GET http://example.com/tools` of a `local: true` page, from `127.0.0.1`, `Host: 127.0.0.1:<port>`, `Sec-Fetch-Site: none`, 403 `keel.denied`; `GET http://127.0.0.1:<port>/tools`, `Host: example.com`, the page; `GET /`, `Host: 127.0.0.1:0`, 403 `keel.denied` with the six k.security headers.
