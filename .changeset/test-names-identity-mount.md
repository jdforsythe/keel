---
"@keel/testing": minor
"@keel/router": minor
"@keel/compiler": minor
"@keel/cli": minor
"@keel/check": minor
"@keel/scaffold": minor
"@keel/std-sessions": minor
---

A test names the identity mount (k.guards Client). `renderRoute(id, { routes, mount })` takes `mount`, the default export of the project's `identity.ts` that the test imports, the value the built entry passes: with it and without `user` the router reads `/__keel/user`, matches no page under `mount.path` and a shell sends mount requests under it; without it there is none of these, whatever the test's modules import. `app` with `mount` is E1722. Nothing is loaded before a test file: the `keel()` plugin and `keel test` add no setup file, so a test runs the same under `keel test` and plain vitest; `@keel/router/internal` no longer exports `identityMounts`, and `@keel/compiler/hosting/identitySetupFiles` is gone. `keel check` reports E1730 in a project with `identity.ts` for a test's `renderRoute` whose literal options name neither `mount` nor `app`; its fix imports `identity.ts` as `mount` and passes it. `keel scaffold route` writes `mount` into a route test of such a project, and `keel session replay|minimize|to-test` pass the project's identity mount for a page no `node` deployable serves (`replay` and `minimize` take `mount`; with `serve` it is E1722).
