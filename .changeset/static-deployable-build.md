---
"@keel/compiler": patch
---

`keel build` of a topology whose only deployables are `static` serves the first one's resume entry, and writes a default `index.html` when the project has none, so a fresh `keel scaffold project <name> --adapter static` builds. A build entry no deployable serves names the fix: the deployables `KEEL_DEPLOYABLE` may name, or a `client` or `static` deployable to add to `topology.ts`.
