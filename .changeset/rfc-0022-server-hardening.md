---
"@keel/server": minor
"@keel/store": minor
"@keel/services": patch
"@keel/compiler": patch
---

RFC 0022 server hardening. server: `mode` defaults to `production`; writes must be same-site (`Sec-Fetch-Site` same-origin/none, own `Origin`, `accept: application/json` + `x-keel: 1`, or neither header) else 403 `keel.denied`; dev `/__keel/inspect` answers only a loopback or listed host and an absent, own, or `inspect.origins`-listed `Origin`; submitted values drop `__proto__`/`constructor`/`prototype`; exposed stores reach `#k-state` as state only unless `expose: [{ store, log: true }]`; each request scope is isolated so overlapping requests may create same-id stores. store: `isolate(scope)`; `store()`/`stores()` use the nearest isolated scope's registry, else the module registry. services: requests send `x-keel: 1`. compiler: the Vite inspect middleware gates GET and POST by host and origin, extra origins from `KEEL_INSPECT_ORIGINS`.
