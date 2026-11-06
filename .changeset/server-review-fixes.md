---
"@keel/server": patch
"@keel/router": minor
"@keel/forms": minor
---

router exports `matchUrl`, `parseSearch`, `compileRoutes`, `compileTable`, `fieldsError`, `needsBare`, `guardTable`, `runGuard` and the types `Level`, `Located`, `Match`, `Segment`, `Table`; forms exports `messageFor`. server uses them instead of copies, resolves `RouteDef.guard` names only (`guards`, then the router registry), adds `createApp({ expose })` (`#k-state` holds stores created in the request scope plus exposed ones) and sends `cache-control: no-store` on action responses and 302/303 redirects.
