# RFC 0087: Client hosting: a static artifact, a node host, and allowed origins

Status: implemented. Accepted (2026-11-11); the user's answers are D1 and D3. Design RFC for backlog 0375, with the context of 0406. It builds on RFC 0086 (API routes).

## Decisions (user, 2026-11-11)
- D1: the node host is declared as `host: '<node deployable>'` on the `client` deployable (Proposal 5).
- D3: the caller cookie stays same-site only, with W1567 (Proposal 4). A caller token for cross-site clients is recorded as a later feature in `tasks/FUTURE.md`.
- D2: `KEEL_ALLOW_ORIGINS` and the `keel-peer` tag keep the names written here (orchestrator, RFC defaults).

## Words
A static host is any server that returns files: S3, a CDN, nginx. The `static` adapter is a different thing: pages prerendered at build, with no params and no actions (E1553). This RFC is about a `client` deployable, whose loaders, actions and views run in the browser, and never uses "static" for it without "host".

## Problem
Operator decision, 2026-11-11: the right way of deploying is a static host; Keel provides a default way for node to serve the client, but because Keel builds production apps the client must also build for deployment on S3, a CDN or elsewhere. On the origin split, as in any app, the server sets CORS for it to work. Evidence from the code as of this RFC:

1. **The client build is not a deployable's artifact.** `keel build` writes `dist/<name>/` per `node` deployable only (`packages/cli/src/internal/viteTargets.ts`, `packages/compiler/src/vite.ts`). The `client` build is the project's own `vite build` into `dist/`, beside `dist/api/`, and nothing names it, checks it or documents it as something to upload.
2. **No server serves it.** `createApp` answers its route table, `/assets/*` and `/keel-mark.svg` (`servedEntry.ts`, `loadAssets.ts`). golden-1's `api` has no `/` route and never reads `dist/index.html`, so `GET /` on the production server is 404.
3. **A browser client has no API origin.** `service({ module })` in a browser resolves to the document's origin (`moduleTarget.ts`). golden-1 works around it with `service({ base: location.origin })` in `todosApi.ts`. `KEEL_PEER_<NAME>` exists for `node` deployables only.
4. **Another origin is refused twice.** A write from another origin fails the same-site check with 403 `keel.denied` (`sameSite.ts`; its comment says a preflight "is never granted"). An `OPTIONS` preflight gets 405 (`handle.ts`). The server sets no `access-control-*` header outside inspect.
5. **The caller cookie does not cross sites.** It is `HttpOnly; SameSite=Lax; Path=/` with the `__Host-` prefix on https (`callerOf.ts`), and `buildRequest.ts` sets no `credentials`. From another origin no cookie is sent, so each write mints a caller the browser drops, and `undoWhere` by caller finds nothing.
6. **No deploy file covers a client.** `deployFiles.ts` filters `adapter === 'node'`.

## Proposal

### 1. The artifact
`keel build` writes `dist/<name>/` for every `client` deployable: `index.html`, `assets/` (every file content-hashed) and `keel-mark.svg`. It is the whole deployable. Nothing in it names a server path, and every URL in it is root-absolute.

A static host has to do three things, stated in the guide and nowhere generated:
- return the files of `dist/<name>/` at the origin's root;
- return `/index.html` with status 200 for a path that is no file (the router matches in the browser);
- cache `assets/*` as immutable and everything else as `no-cache`.

### 2. Where the API is
`keel build` reads `KEEL_PEER_<NAME>`, the key a `node` deployable already reads, for each `node` deployable, and writes one tag per value into `index.html`:

```html
<meta name="keel-peer" data-deployable="api" content="https://api.example.com">
```

The generated client entry reads the tags and binds them to its `ctx`, so `service({ module })` resolves in a browser to the origin of the module's deployable when a tag names it and to the document's origin when none does. A request to another origin is sent with `credentials: 'include'`. `service({ base: location.origin })` in app code is no longer needed, and golden-1's `todosApi(origin)` becomes `service({ module: 'api', schema: todos })`.

The tag is in the one file that is not hashed, so one build serves several environments: a deploy step may rewrite the tag's `content`. A value that is not an http(s) origin fails the build with E1565, naming the key and no value.

With no `KEEL_PEER_<NAME>` at build the client calls its own origin. That is the node host of Proposal 5, and a CDN that routes API paths to the node deployable, both of which need no allowed origin.

### 3. Allowed origins
`DeployEnv` gains `KEEL_ALLOW_ORIGINS`: a comma-separated list of http(s) origins, passed as `createApp({ allow })`. `*` and a value with a path fail E1560. For a request whose `Origin` is in the list, to an API route (RFC 0086):

- `OPTIONS` with `access-control-request-method`: 204 with `access-control-allow-origin` the request's origin, `access-control-allow-methods` the route's methods, `access-control-allow-headers: accept, content-type, x-keel`, `access-control-allow-credentials: true`, `access-control-max-age: 600` and `vary: origin`. No guard, loader or action runs.
- Any other method: the response carries `access-control-allow-origin`, `access-control-allow-credentials: true` and `vary: origin`.
- A write passes the same-site check: an allowed `Origin` is a fourth accepted proof.

Pages, assets and every request from an origin outside the list are answered as today: no header, 405 for the preflight, 403 for the write. Allowing an origin grants it what a same-origin page has and nothing else, and only on routes declared `api: true`.

### 4. The caller across origins
The cookie stays `HttpOnly; SameSite=Lax` and host-only. It travels when the client's origin and the API's origin are same-site, as `app.example.com` and `api.example.com` are, and the `credentials: 'include'` of Proposal 2 sends it. That is the supported split.

When they are cross-site (a bucket's own domain and an API domain), browsers neither send nor store the cookie, `caller` is `''` on reads and new on each write, and caller-scoped features such as `undoWhere` do not work. The server reports it: a request from an allowed origin with `Sec-Fetch-Site: cross-site` is one W1567 `diag` per origin, saying the caller cookie cannot reach it and naming the two fixes (a shared registrable domain, or one origin through the node host or a CDN route).

### 5. The node host
A `client` deployable may name the `node` deployable that serves it:

```ts
export default topology({
  web: { modules: ['todos'], adapter: 'client', host: 'api' },
  api: { modules: ['api', 'digest'], adapter: 'node' },
})
```

`keel build` then also copies the client artifact into `dist/api/` (its `index.html`, its `assets/` beside the host's own), and `api`'s `createApp` returns `index.html` (200, `no-cache`) for a GET or HEAD document request that matches none of its routes and no peer's. A runtime or event-stream request to an unmatched path stays a 404. The host's own pages win over the client's, and E1559 already refuses one path in two deployables.

One process, one origin, one `Dockerfile` (the existing one copies `dist/api/`), no allowed origin and a working caller cookie. The scaffold `project` template and golden-1 declare `host`, so `GET /` on the built server is the app. The static artifact `dist/web/` is written either way, so moving to a static host later is a deploy change and a one-line edit.

E1566: `host` on a deployable that is not `client`, naming an unknown or non-`node` deployable, or two `client` deployables naming one host.

### 6. Deploy files and docs
No deploy file is generated for a static host; hosts differ and the contract is the three lines of Proposal 1. The generated CI job for a `client` deployable runs `keel build` and leaves the upload to the app. `docs/guide/deploy-client.md` shows the node host, the same-site split with `KEEL_PEER_API` and `KEEL_ALLOW_ORIGINS`, and one static host worked through. `docs/THREAT-MODEL.md` gains an Allowed origins entry and its Writes entry lists the fourth proof.

### 7. Known limits
- A client served under a path prefix (`https://example.com/app/`) is not supported: URLs are root-absolute and no `base` option exists.
- One `client` deployable per host.
- A CDN in front of a `node` deployable as a cache is untested.
- `keel dev` is unchanged: one process, one origin.

## Alternatives
- **`access-control-allow-origin: *`.** Credentials cannot be sent with it, and it opens every API route to every site.
- **Allowed origins on every route.** Pages are never fetched across origins; limiting the grant to `api: true` routes keeps HTML and assets out of it (RFC default 6).
- **The API origin compiled into the JavaScript.** Every environment needs its own build and the hashed file names change with it.
- **A config file fetched at startup.** One more request before the first loader, and a second file with the tag's job.
- **`SameSite=None; Secure` for the cookie when origins are cross-site.** Safari and Firefox block the cookie as third-party, so it fixes Chrome only, and it moves the write defense from the cookie attribute to the origin list alone. Refused by D3.
- **The caller token in a response header, kept by the client in `localStorage`.** Works cross-site, and gives any script on the page the token that `HttpOnly` withholds.
- **A host chosen automatically when there is one `node` deployable.** A second `node` deployable would silently change what the first serves (principle 2).
- **`serves: 'web'` on the `node` deployable.** Equivalent. `host` on the client keeps the field beside the artifact it places.
- **A generated static file server for the client (`dist/web/server.mjs`).** A second node process that still needs allowed origins and the same-site rule; the node host covers the default with one.
- **Generated files per host (S3 policy, `_redirects`).** One file per vendor to keep current; the three-line contract is stable.

## Spec diff
k.topology, k.server and k.services are each within 6 tokens of the 1,500 token limit, so the text goes to a new section.
- **k.hosting (new, `proposed`)**: the artifact and the host contract (Proposal 1), `KEEL_PEER_<NAME>` at build and the `keel-peer` tag (2), `KEEL_ALLOW_ORIGINS` and the three behaviors (3), the same-site rule and W1567 (4), `host` and the document fallback (5), E1565, E1566, and the conformance clauses below.
- **k.topology** Declaration: `{ modules, adapter }` becomes `{ modules, adapter, host? }` with "(k.hosting)"; Build: "per `node` deployable" becomes "per `node` or `client` deployable (k.hosting)". Offset by rewording.
- **k.server** Request flow: the same-site list gains "an allowed `Origin` (k.hosting)". Offset by rewording.
- **k.services** API: "in a browser the document's origin" becomes "in a browser its peer's origin (k.hosting), else the document's". Offset by rewording.

## Conformance diff
New file `packages/server/conformance/hosting-0087.test.ts`, written by the conformance-writer from k.hosting under `rfc:0087`:
- `keel build` of a fixture with a `client` deployable `web` writes `dist/web/index.html` and hashed files under `dist/web/assets/`; no file in it holds a URL that is not root-absolute or absolute.
- With `KEEL_PEER_API=https://api.test` the built `index.html` has one `keel-peer` tag for `api`, and a `service({ module })` call from the client entry under a sim ctx fetches `https://api.test` plus the path with credentials included; with it unset the call goes to the document's origin; with `KEEL_PEER_API=nope` the build fails with one E1565 naming the key.
- With `allow: ['https://app.test']`: a preflight from that origin to an API route is 204 with the six headers; a POST from it runs the action and carries the two response headers; the same two requests from `https://other.test` are 405 and 403; a preflight to a page route is 405.
- `KEEL_ALLOW_ORIGINS=*` exits 1 with one E1560 naming the key.
- A request from an allowed origin with `Sec-Fetch-Site: cross-site` logs W1567 once for that origin.
- With `host: 'api'`, `node dist/api/server.mjs` answers `GET /` and `GET /no/such/page` with the client `index.html`, an unmatched runtime GET with 404, and a client asset as `immutable`; `host` naming a `client` deployable is E1566.

One existing clause changes: k.topology's "writes `deploy/x/Dockerfile`, `deploy/y/Dockerfile`, `deploy/compose.yaml` and no other Dockerfile" stays true and gains nothing; its fixture needs no edit.

## Migration
- golden-1: `topology.ts` gains `host: 'api'`; `todosApi.ts` and `Suggestions.tsx` call `service({ module: 'api' })`; the README's run steps serve the app from `pnpm api`; the client proxy script in `docs/guide/build-golden-1.md` goes.
- golden-2 and the scaffold `project` template: the same `host` line where a `client` deployable exists.
- A project whose deploy step uploads `dist/index.html` and `dist/assets/` uploads `dist/<name>/` instead. This is the one path change and it is called out in the changeset.
- A `node`-only app is unaffected.

## Token impact
k.hosting is about 750 tokens. The three edited sections stay at their counts by rewording. `@keel/server` is 20 bytes under its budget (16,364 B of 16,384 B); allowed origins and the document fallback need a re-base with the reason in the commit, or the trim of backlog 0391 first. `@keel/services` gains the `credentials` branch and `@keel/compiler` the client target and the tag; both are measured at implementation.
