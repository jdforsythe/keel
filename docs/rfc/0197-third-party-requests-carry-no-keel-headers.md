# RFC 0197: k.services: a request to a third-party origin carries no Keel header

Status: accepted (ADR-0219). Amends k.services (API, Encoding, Conformance). From `examples/client-only-api` (examples finding 10).

## Problem
A Keel front end with no back end, a `client` deployable that reads another organisation's API, must work with nothing but the API's own CORS policy. It does not. `examples/client-only-api` reads `https://api.github.com/repos/nodejs/node/releases` through `githubApi = service({ base: "https://api.github.com", schema: GitHubApi })`, with `origins.connect` declaring the origin (k.origins). Each `GET` carries `x-keel: 1`, so Chromium sends an `OPTIONS` preflight with `access-control-request-headers: x-keel` first; an API whose preflight answer lists only the headers it knows refuses the call, and the page can only show its alert.

The run time does what the spec says. k.services Encoding: "Every request sends `accept: application/json` and `x-keel: 1`" (`packages/services/src/internal/buildRequest.ts:56`). The header is k.server's same-site proof for writes to a Keel server (k.server Request flow) and the gate on `GET /__keel/user` (k.guards Client); a third party reads neither. App code has no way round it: `ctx.net.fetch` in app code is E1651, so the service client is the only way to call the API, and an OpenAPI-imported client (k.openapi) is a `base` service too.

## Proposal
### The rule
Keel's own headers go only to Keel. A request's target is a Keel origin or a third party:
- Keel origins: every target of a `contract` service (in process, a peer, the document's origin, `http://<module>.keel.invalid`); for a `base` service, the document's origin in a browser, each `keel-peer` origin (k.hosting Peers) and the origin of each URL peer of the `createApp` that bound `ctx` (k.topology).
- A third party: any other origin, declared under `origins.connect` or not, from a browser or a `node` deployable.

### What each request carries
| Item | To a Keel origin | To a third party | Why |
| --- | --- | --- | --- |
| `accept: application/json` (`text/event-stream` for `events`) | yes | yes | Says what the client decodes; CORS-safelisted, so it adds no preflight. |
| `authorization: Bearer <token>` for a `bearer` | yes | yes | The author gave it; an API that takes a bearer allows it in its preflight. |
| `content-type: application/json` | with a body only | with a body only | Describes the JSON body; a bodiless call sends none (unchanged). A JSON body is preflighted by any browser, which the API's CORS policy must allow anyway. |
| `x-keel: 1` | yes | no | k.server's same-site proof and k.guards' `/__keel/user` gate; meaningless to a third party and the one header that forces a preflight on a GET. |
| `x-keel-user` for a `user` | `contract` service only | no | A MAC under the app's secret for its own deployables (k.user). On a `base` service a `user` is `api.input` at `user`, nothing sent; a `renderRoute` `user` (k.user Testing) adds none. |
| credentials | `contract`: `include` to a cross-origin peer, else the `fetch` default | `fetch` default (`same-origin`) | No page cookie, the `caller` cookie included, reaches a third party, and none of a third party's comes back into the call. Unchanged. |
| `redirect: "manual"` | yes | yes | A 3xx is `api.status`; not a header, adds no preflight. Unchanged. |
| tracing or diagnostic headers | none | none | Keel adds none to an outbound request; `ctx.net.fetch` adds nothing. |

So a `base` GET with no `bearer` to a third party is a CORS-simple request, and a client-only app needs only the `connect` declaration and the API's own CORS policy.

### A third-party answer is not a Keel answer
Unchanged rules, now stated: a `base` service never reads a k.server `Result`. A third party's body shaped like one is plain data: a 2xx body is decoded by `output` (failing it: `api.decode`), a non-2xx body is `api.status` decoded by `errors[status]` or `null`, and a 502 `keel.unreachable` body is `api.status` as well, never `api.network` or a `keel.*` error.

### What does not change
`service({ contract })` requests, mount requests (k.return) and the router's `GET /__keel/user` (k.guards Client) keep `x-keel: 1`. k.hosting's CORS answer keeps `x-keel` in `access-control-allow-headers`. k.server's same-site check is unchanged: a `base` write to a Keel origin still carries `x-keel: 1`. What an author writes does not change.

## Alternatives
- **A `base` service sends no Keel header, whatever its origin.** Rejected: a `base` service pointed at the app's own `node` deployable (a k.api route, or a non-literal `base` E1567 cannot judge) would lose the same-site proof its writes rely on when neither `Origin` nor `Sec-Fetch-Site` decides.
- **A per-service option (`keelHeaders: false`).** Rejected: the default would still break the client-only case, and an author should not need to know a Keel header exists to call another organisation's API.
- **Drop `x-keel` only for origins declared under `origins.connect`.** Rejected: the declaration is a browser policy; a `node` deployable calling a third party declares nothing, and its request should be the same.
- **Also drop `accept`.** Rejected: it is safelisted, so it costs no preflight, and it tells the API what the client decodes.
- **The app's own public origin (`createApp({ origin })`) as a Keel origin.** Not proposed: a server calling its own public origin through a `base` service sends neither `Origin` nor `Sec-Fetch-Site`, which k.server's same-site check already passes.

## Spec diff
Applied in this commit: k.services API (the `user` sentence), Encoding (the rule and the third-party answer) and Conformance (four clauses). k.services' status is `implemented` until those clauses' conformance and build land, when it returns to `conformance-covered`. k.openapi, k.user, k.hosting and k.server are unchanged: the OpenAPI client is a `base` service, and k.user already names `service({ contract })` as the method that takes `user`.

## Conformance
Four k.services clauses, by the `conformance-writer`, in `packages/services/conformance`:
1. A third-party request's headers: a GET with no `bearer` exactly `accept: application/json` with credentials `same-origin` (CORS-simple); with `bearer` exactly `accept` and `authorization`; a POST with a body exactly `accept` and `content-type`; an `events` GET exactly `accept: text/event-stream`; none `x-keel` or `x-keel-user`.
2. The same `base` client to the document's origin, a `keel-peer` origin or a `createApp` URL peer adds `x-keel: 1`; every `contract` request carries it, in process too.
3. A `base` call naming `user` is `api.input` at `user` and sends nothing; under `renderRoute(id, { user })` a `base` call carries no `x-keel-user`.
4. A third party's Keel-shaped body: a 200 `{ ok: false, error: { code: 'keel.denied', ... } }` failing `output` is `api.decode`; a 403 with it and no `errors[403]` is `api.status` 403 with `body: null`.

## Migration
None.

## Token impact
k.services grows by about 330 tokens.

## Build note
1. Conformance (`conformance-writer`) from k.services. 2. `@keel/services`: `Target` gains `keel: boolean`; `moduleTarget` sets it `true`; `service`'s `base` target sets it per call from `base`'s origin against the document's origin (`location`) and the URL values of the `createApp` or client-entry binding (`MODULES_KEY`, which holds the peer and `keel-peer` URLs); `buildRequest` adds `x-keel` only when `keel` is set. 3. The example's smoke step (`tooling/smoke/examples.mjs`, `client-only-api`) asserts no `OPTIONS` reaches its `api.github.com` stand-in and the `GET` has no `x-keel`. 4. The keel-server skill (service clients) and keel-deploy's note on the `x-keel` preflight say a third-party request carries no Keel header.
