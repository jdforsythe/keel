---
"@keel/cli": minor
"@keel/compiler": minor
"@keel/check": patch
"@keel/scaffold": patch
"@keel/std-tauri": minor
"@keel/std-capacitor": minor
---

A shell build of an app whose topology has no `node` deployable reads no `KEEL_ORIGIN` and has no origin: the entry passes none to the drivers or `shellMount`, `ShellBuild.origin` is absent, and the tools' environment holds no `KEEL_ORIGIN`. `KEEL_ORIGIN` set in such an app is E1574 `KEEL_ORIGIN is set and topology.ts has no node deployable to answer it`; an empty one counts as unset. With no origin, the drivers' `net` refuses a request on the page's own origin with a `TypeError` and no native call, and sends only to the declared `origins.connect` origins. Tauri writes no `capabilities/http.json` when nothing is allowed and removes a stale one; Capacitor's `KeelHttp.allow` is the `connect` list, `[]` when empty, with no Android cleartext config. The generated shell CI job sets `KEEL_ORIGIN` only with a `node` deployable.
