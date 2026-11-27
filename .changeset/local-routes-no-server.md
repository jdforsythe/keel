---
"@keel/server": patch
"@keel/check": patch
"@keel/compiler": patch
"@keel/cli": patch
---

A `local: true` entry in a module a `client` or `static` deployable serves is E1511 `<id>: local route in <adapter> deployable <name>, which has no server`, from `keel check`, `keel build` (which writes no `dist/<name>/`) and `createApp`; `createApp`'s API-route E1511 reads `<id>: API route in <adapter> deployable <name>, which has no server`. A deployable never forwards a request for a peer's `local` route: it answers 403 `keel.denied` with the k.security headers. `server.mjs` answers a request with no `Host` (HTTP/1.0 or HTTP/1.1) 403 `keel.denied`, and every refusal it makes before `createApp` carries the k.security headers. E1734's fix text lists, safest first, the host sysctls, a seccomp profile allowing `CLONE_NEWUSER`, `docker run --security-opt seccomp=unconfined` and `--no-sandbox`.
