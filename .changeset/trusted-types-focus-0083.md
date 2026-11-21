---
"@keel/runtime-dom": patch
"@keel/router": patch
---

`template()` builds its HTML through the Trusted Types policy `keel` where `globalThis.trustedTypes` exists (k.security). After a navigation to another route the router focuses the page's first `h1`, else `main`; a navigation within one route keeps focus (k.head).
