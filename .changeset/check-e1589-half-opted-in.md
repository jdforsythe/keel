---
"@keel/check": minor
"@keel/compiler": minor
---

E1589: with `identity.ts`, a `static` deployable, or a `client` one without `servedBy`, at its key in `topology.ts`, with its explanation: no origin of it answers the router's `/__keel/user` read. `keel check` and `keel build` report it, one per deployable, and not where a module file the deployable serves is E1581.
