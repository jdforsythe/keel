---
"@keel/compiler": minor
---

New `serverOnlyCalls(files, topology)`: E1558 (k.topology) at each `loader` or `action` call naming `stores`, and each `loader` whose `fn` is `async function*`, in a `*.server.ts` of a module a `client` or `static` deployable serves. `keel check` and `keel build` call it beside `pathCollisions`.
