# ADR-0220: a shell's net sends to declared origins only, and a shell names the plugins an app must list (RFC 0198)

**Status:** proposed (for the operator to confirm).

**Context.** A shell's native HTTP client is outside the content security policy. Capacitor's driver sent any URL; Tauri's capability allowed `KEEL_ORIGIN` alone, and `tauri-plugin-http` 2.9 follows a redirect out of its scope unless `plugins.http.scopeRedirects` is set. A browser client sends to its own origin, its `keel-peer` origins and its declared `origins.connect` origins. Separately, `cap sync` installs a native plugin only when the app's own `package.json` lists it, and a missing one failed silently at run time.

**Decision.**
- A shell's `net` sends to `KEEL_ORIGIN`, the build's `keel-peer` origins and the declared `origins.connect` origins, and refuses every other URL with the `TypeError` any failure gives (`api.network` to app code).
- The native client follows no redirect. The driver follows and holds each hop to the same list.
- The list is enforced outside the page too: Tauri's http scope with `scopeRedirects`, and `KeelHttp`'s `allow` configuration.
- A shell target's `plugins(app)` names the packages the app must list, each at an exact version. A missing or differing one is E1572 with its fix, from `keel check` and a shell build.
- A plugin is given only for a feature the app turned on: `@capacitor/browser` only with `identity.ts`. Launch and return links are every shell's, so `@capacitor/app` and Tauri's deep-link crates are too.

**Alternatives.**
- Any origin, or `KEEL_ORIGIN` only: each makes a shell differ from a browser.
- Native redirect following with native hop checks: three stacks, none testable without a device.
- A new error shape or a new diagnostic code: a browser gives a `TypeError`; E1572's sentence already covers the plugin.
- `peerDependencies`, or a generated `package.json`: neither puts the plugin where `cap sync` reads and resolves it.

**Consequences.** `modules/` behave the same in a browser and in both shells for a declared and an undeclared origin. Each driver carries a redirect loop. A Tauri shell without identity gains two crates. golden-1 lists `@capacitor/app`. A Capacitor app pins its plugins to the versions `@keel/std-capacitor` pins.
