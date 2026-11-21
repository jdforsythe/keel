---
"@keel/compiler": minor
"@keel/cli": patch
---

A stdlib module placed in `topology.ts` is served from its package's `./routes` export: the server, dev and client entries, `routes.json`, the static route read and `surface.json` all resolve it the same way. An app no longer spreads a stdlib package's routes into a module of its own to serve them.
