# RFC 0156: k.mount: `identityMount` refuses a malformed `path` at run time; a router matches no page at or under its own mount, nor a path holding a `\`

Status: proposed (ADR-0178), for the orchestrator to confirm. For backlog 0893 and 0894, under review decision D39.

## Decisions
- D1: `identityMount(path)` throws E1580 when `path` is not lowercase `/` segments (`/^(\/[a-z0-9-]+)+$/`), before it records anything. `keel check` already reports a literal of another form; the throw covers a call `keel check` does not read (a `vite build` alone, a direct call, a test).
- D2: a router matches no page at or under its `mount`, a `createRouter` option holding the identity mount's `path`, so a link click, `navigate` or `ok(href)` there is a document navigation even where a `:param` route of its table would fit. The mount is the router's own: the build's client entry of a project with `identity.ts` passes `<its default export>.path`, `createApp` matches no page under `handle.path`, `renderRoute` takes `mount` too. Another router in the same process, given another mount or none, routes by its table alone.
- D3: a router matches no page at a path holding a raw `\` (`%5C` in a path is an ordinary character): a URL parser reads `\` as `/`, so `/\x` names the host `x`.
- D4: E1579 stays a literal-path rule: a `:param` route such as `/:locale/:slug` beside `handle.path` `/api/auth` is legitimate, since D2 already keeps a request there from reaching the page.

## Problem
Three behaviours the build has hold no spec sentence. k.mount states `path` as a literal checked by `keel check` only, so `identityMount('/\\evil.example')` made outside a checked project gives a mount whose `href()` a browser resolves off-origin. k.mount Navigation says a router handles only what its table matches, so a table with `/:svc/:act` takes `/api/auth/sign-out` client-side and the identity handler never sees the request. And nothing says a path with a `\` is no page. A first fix kept the mount paths in one module-level set that only grows, so one app's or test's mount changed every other router's routing in the process (principle 2).

## Proposal
`packages/router`: `identityMount` throws E1580 for a malformed `path`. `matchUrl(table, url, mount?)` returns `notFound` for a path at or under `mount` or holding a `\`. `createRouter` and `createRouterWith` take `mount?: string`. `packages/compiler`: `entryCode(..., identity)` imports `identity.ts`'s default export and passes `mount: __keelIdentity.path`; `vite.ts` passes whether the project has `identity.ts`. `packages/server`: `createApp` matches with `handle.path`. `packages/testing`: `RouteRenderOptions.mount`. The shell's mount requests (k.return) still read every `identityMount` path, as k.return states.

## Alternatives
- Keep the module-level set for page matching: one app's mount changes another's routing in the same process.
- Refuse a `:param` route that fits `handle.path` with E1579: refuses a legitimate `/:locale/:slug`; D2 closes the hole without it.
- Read the mount from the ctx: `identityMount` takes no ctx, and a ctx is not an app.

## Spec diff
k.mount: status `proposed`; the `href` consequence sentence (root-relative under `path`), the `links` example and the cookie sentence are as before; the Server form-action clause stays shortened. Navigation: "A router handles client-side only a path its table matches as a page" gains "and k.mount-scope allows". New section k.mount-scope (status `proposed`, map row): the mount test is textual and case-sensitive on the undecoded path, on client and server alike; a router matches no page at or under its own `mount`, nor at a path holding a raw `\`; `identityMount` throws E1580 for a malformed `path`; limits: a proxy that decodes or lowercases paths must not sit in front, and a hand-wired `createApp` whose `handle.path` differs from the root `identity.ts` path has two mounts, tied by `keel check` (E1580).

## Conformance diff
By the `conformance-writer`, under `rfc:0156` (k.mount suites in `packages/router/conformance/` and `packages/testing/conformance/`):
- `identityMount(p)` throws E1580 for each of `'/\evil.example'`, `'//x.example'`, `''`, `'/'`, `'api'`, `'/API'`, `'/a/'`, `'/a b'`, `'/a?b'`; `identityMount('/api/auth').path` is `'/api/auth'`.
- `renderRoute` of a page over a table of `/`, `/:one` and `/:svc/:act`, with `mount: '/gate'`: `navigate` to `/gate/sign-out` and to `/gate` each record one GET in `documents()` and keep the page; `navigate` to `/gatehouse/x` renders the `/:svc/:act` page and records nothing.
- In one test, after `identityMount('/gate')`, a `renderRoute` of that table with no `mount`, and another with `mount: '/other'`: `navigate` to `/gate/sign-out` renders the `/:svc/:act` page in each and records nothing; in the second, `navigate` to `/other/x` records one GET.
- With `mount: '/gate'` or none, `navigate` to `/a/\x` records one GET in `documents()`, keeps the page, and `location().entries` does not grow.
- `createApp` with `handle.path` `/api/auth` and a page `/:locale/:slug` starts; a GET of `/api/auth/session` reaches `handle.fn`, and a GET of `/en/about` renders the page.

## Migration
An app with `identity.ts` changes nothing: its build's entry passes the mount. A test of a page whose table has a `:param` route that fits the mount passes `mount: identity.path` to `renderRoute`. A hand-written `createRouter` passes `mount`.

## Token impact
k.mount +2 characters net, 5,995 of 6,000.

## Build order
1. Built on `lane-w03b` with the spec diff (this commit). 2. `conformance-writer` from the bullets above. 3. k.mount back to `conformance-covered` when they are green.
