---
"@keel/server": minor
"@keel/services": minor
---

`createApp({ allow })` and `KEEL_ALLOW_ORIGINS` list the http(s) origins granted on API routes: a preflight from one is 204 with the CORS headers, other responses carry `access-control-allow-origin`, `access-control-allow-credentials: true` and `vary: origin`, and a write from one passes the same-site check. Matching is exact; pages, assets and other origins are unchanged. `*` or a path in `KEEL_ALLOW_ORIGINS` is E1560. An allowed origin that is cross-site logs W1567 once. `topology()` accepts `host` on a `client` deployable and throws E1566 for a bad one; the named `node` deployable answers unmatched GET and HEAD document requests with the client's `index.html`. In a browser, `service({ module })` calls the origin the `keel-peer` tag names, with `credentials: "include"` when it is not the document's.
