---
"@keel/cli": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/std-capacitor": minor
"@keel/std-tauri": minor
---

A shell's `net` sends to `KEEL_ORIGIN`, the build's `keel-peer` origins and the deployable's declared `origins.connect` origins, and refuses every other URL with a `TypeError` (`api.network` to app code). `capacitorDrivers` and `tauriDrivers` take `{ origin, connect }`; the generated shell entry passes `connect`, and `ShellBuild` holds it. The native client follows no redirect: each driver follows, at most 20 hops, each held to the same list. The list is enforced outside the page too: `keel build --target capacitor` writes `plugins.KeelHttp.allow` into the build's `capacitor.config.json`, which `KeelHttp` reads natively, and a Tauri build's `capabilities/http.json` allows the same origins with `plugins.http.scopeRedirects` set.

`ShellTarget` has `plugins(app)`: the npm packages an app lists in its own `dependencies`, each at an exact version. A missing or differing one is E1572 with its fix, from `keel check` and `keel build --target <shell>`. A Capacitor app lists `@capacitor/preferences` and `@capacitor/app`, and with `identity.ts` `@capacitor/browser`; a Tauri app lists none. Every Tauri shell holds the deep-link and single-instance crates; the opener only with `identity.ts`. `@keel/check` exports `dependencyNeed`; `@keel/compiler/hosting/shellConnect` gives a build's `connect` list; `tauriHttpCapability(origin, connect?, identity?)`.
