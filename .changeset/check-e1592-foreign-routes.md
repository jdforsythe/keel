---
"@keel/check": minor
"@keel/compiler": minor
---

E1592: `identity.server.ts`, or a project file it imports, importing the `routes` of a module a `static` deployable, or a `client` one without `servedBy`, serves: its pages are on another origin than the sign-in, so none returns to them. At the import declaration, with its explanation; `keel check` and `keel build` report it, no fix.
