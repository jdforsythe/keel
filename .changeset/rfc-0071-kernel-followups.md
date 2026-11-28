---
"@keel/runtime-dom": minor
"@keel/server": patch
"@keel/compiler": patch
"@keel/ctx": patch
"@keel/check": minor
"@keel/router": minor
"@keel/store": minor
---

Kernel follow-ups to RFC 0070 (RFC 0071).

- **Server-rendered pages.** `#k-state` carries the served `route`. `resume` reports it as the ctx's first `nav`, fires `input` on fields typed before load, and reports queued events to observers before their handlers. `record` now works on `node` and `static` deployables.
- **`observe`.** Observing is a declared capability: E1156 reports an `observe` import in a module whose `capabilities` lack `observe`.
- **Router.** The new public `@keel/router/match` subpath exports `matchHref(routes, href)`.
- **Store.** A `tx` payload may hold `s.secret` fields, which `log()` keeps. `snapshot()` folds entries up to the last secret-holding one into `initial`, so no secret is written.
