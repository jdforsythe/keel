# k.hosting: Client hosting
status: implemented

**Purpose.** A `client` deployable builds to files any static host can serve, finds its API by a tag, and may be served by a `node` deployable instead.

**Artifact.** `keel build` writes `dist/<name>/` per `client` deployable: `index.html`, `assets/` (content-hashed names) and `keel-mark.svg`. Every URL in it is root-absolute or absolute. A static host returns these files at the origin's root, returns `/index.html` with 200 for a path that is no file, and caches `assets/*` as immutable and the rest as `no-cache`.

**Peers.** For each `node` deployable whose `KEEL_PEER_<NAME>` is set at build, `index.html` carries `<meta name="keel-peer" data-deployable="<name>" content="<origin>">`. The client entry binds the tags to its `ctx`: `service({ module })` in a browser resolves to the tagged origin of the module's deployable, else the document's origin, and a request to another origin is sent with `credentials: 'include'`. A value that is not an http(s) origin fails the build (E1565).

**Allowed origins.** `DeployEnv` `KEEL_ALLOW_ORIGINS` is a comma-separated list of http(s) origins, `createApp({ allow })`; `*` or a value with a path is E1560; an origin is its own serialization, a trailing `/` allowed. For a request to an API route (k.api) whose `Origin` is in the list:
- `OPTIONS` with `access-control-request-method`: 204 with `access-control-allow-origin` (that origin), `access-control-allow-methods` (the route's methods), `access-control-allow-headers: accept, authorization, content-type, x-keel`, `access-control-allow-credentials: true`, `access-control-max-age: 600` and `vary: origin`; no guard, loader or action runs.
- Other methods: the response carries `access-control-allow-origin`, `access-control-allow-credentials: true` and `vary: origin`; a write passes the same-site check (k.server).
With a list set, every API route response carries `vary: origin`. Pages, assets and other origins get no other header: the preflight is 405 and the write 403. `createApp` throws E1560 for an `allow` entry that is no origin.

**Caller.** The caller cookie (k.server) is unchanged, so it reaches the API only when the two origins are same-site. A request from an allowed origin with `sec-fetch-site: cross-site` is one W1567 `diag` per origin. Such a request can name its sender with a `bearer` (k.api) instead.

**Host.** `host: '<name>'` on a `client` deployable names the `node` deployable that serves it. `keel build` also copies the client artifact into `dist/<host>/`, and the host's `createApp` answers a GET or HEAD document request matching none of its routes and no peer's with `index.html` (200, `no-cache`); an unmatched runtime or event-stream request, or a path under `/assets/`, stays 404.

**Rules.** E1565 `KEEL_PEER_<NAME>` at build is not an http(s) origin; names the key, never the value · E1566 `host` that is not a string literal, on a deployable that is not `client`, naming an unknown or non-`node` deployable, or two `client` deployables naming one host · W1567 an allowed origin that is cross-site to the server: the caller cookie cannot reach it; use one registrable domain or one origin.

**Conformance.**
- `keel build` of a fixture with a `client` deployable `web` writes `dist/web/index.html` and hashed files under `dist/web/assets/`; no file in it holds a URL that is neither root-absolute nor absolute.
- With `KEEL_PEER_API=https://api.test` the built `index.html` has one `keel-peer` tag for `api`, and a `service({ module })` call from the client entry under a sim ctx fetches `https://api.test` plus the path with credentials included; unset, the call goes to the document's origin; `KEEL_PEER_API=nope` fails the build with one E1565 naming the key.
- With `allow: ['https://app.test']`: a preflight from that origin to an API route is 204 with the six headers; a POST from it runs the action and carries the two response headers; the same requests from `https://other.test` are 405 and 403; a preflight to a page is 405.
- `KEEL_ALLOW_ORIGINS=*` exits 1 with one E1560 naming the key.
- A request from an allowed origin with `sec-fetch-site: cross-site` logs W1567 once for that origin.
- With `host: 'api'`, `node dist/api/server.mjs` answers `GET /` and `GET /no/such/page` with the client `index.html`, an unmatched runtime GET with 404, and a client asset as `immutable`; `host` naming a `client` deployable is E1566.
