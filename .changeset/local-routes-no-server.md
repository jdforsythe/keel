---
"@keel/server": patch
"@keel/check": patch
"@keel/compiler": patch
"@keel/cli": patch
"@keel/services": patch
---

A `local: true` entry in a module a `client` or `static` deployable serves is E1511 `<id>: local route in <adapter> deployable <name>, which has no server`, from `keel check`, `keel build` and `createApp`; `local` other than the literal `true` is E1510 at the member; a `keel build` failing with either leaves no `dist/<name>/` of the deployable serving the entry; `createApp`'s API-route E1511 reads `<id>: API route in <adapter> deployable <name>, which has no server`. Every request a deployable forwards, and every request a server's `service` call sends, carries `x-keel-forwarded: 1`, and a `local` route refuses any request carrying it 403 `keel.denied`, matched by the peer's own matcher. `server.mjs` answers a request with no, an empty, a repeated or an unreadable `Host` 403 `keel.denied`, and one its HTTP parser rejects 400; every refusal it makes before `createApp` carries the k.security headers. E1734's fix text lists, safest first, the host sysctls, a seccomp profile allowing `CLONE_NEWUSER`, `docker run --security-opt seccomp=unconfined` and `--no-sandbox`.
