# ADR-0241: k.guards: a test names the identity mount; `keel test` loads nothing before a test file (RFC 0219)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** RFC 0209 made the project's `identity.ts` a vitest setup file, both through the `keel()` plugin and in `keel test`. `renderRoute` then took the first identity mount made in the process. A route test's request log, its guard's `user` and its mount scope therefore depended on a file the test never named, which breaks principle 2 (nothing outside a file changes what it does). The operator held the principle (D136).

**Decision.**
- `renderRoute` takes `mount`, the default export of `identity.ts`, which the test file imports. With it, and without `user`, the router reads `/__keel/user`; its mount scope is `mount.path`; a shell harness sends mount requests under it. Without it the harness has no mount. This is the only way a harness gets one.
- Nothing is loaded before a test file: the setup-file mechanism (`identitySetupFiles`, the plugin's `setupFiles`, `keel test`'s `keel-identity` plugin) and the router's `identityMounts` set are removed. A test runs the same under `keel test` and plain vitest.
- E1730 (`keel check`, error, with a fix): in a project with `identity.ts`, a test's `renderRoute` whose literal options have neither `mount` nor `app`. It is never raised at run.
- `app` with `mount` is E1722.
- std.sessions' `replay` and `minimize` take `mount`, and the commands pass it in router mode. The router-form `to-test` file and `keel scaffold route`'s test in an identity project import and pass `mount`.
- The built entry keeps importing `identity.ts`. The request log is unchanged.

**Alternatives.** The import alone as the switch: a page importing `identity.ts` would turn the read on from outside the test. Keeping the setup file with an opt-out. Detecting at run through the module graph. Naming the option `identity`, which is `createApp`'s name for the other half. A warning in place of the error.

**Consequences.** Six app and example test files and one package test add `import mount from '…/identity.ts'` and `mount`. Conformance that got its mount from the module graph passes it explicitly. k.guards, k.testing, k.scaffold and std.sessions read `implemented` until their new or reworded clauses are covered.
