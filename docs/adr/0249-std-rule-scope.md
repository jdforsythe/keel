# ADR-0249: k.check-cache: a std rule is left out only when `deps` loaded it and dropped it (RFC 0227)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** k.check-cache scoped a `@keel/std-*` package's formats and rules by the `deps` of the call. `check()` registers nothing from `deps`, so a rule a test or tool registered itself ran only while a manifest listed its package: nine std suites, conformance cases among them, got no findings, and `check()` answered as no fresh process would.

**Decision.**
- Formats (E1108) stay scoped by the `deps` of the call.
- A std package's rules run on every call, except when `importDeps` (`@keel/compiler/std/importDeps`) first imported the package for an earlier call's `deps` and the app manifests at this call do not list it.
- A rule the caller registered (its package imported before any `importDeps` did, or `defineRule` called) runs whatever `deps` lists, as in a fresh process.
- Two conformance bullets, k.check-cache#12 and #13, in `packages/std-db/conformance/`.

**Alternatives.**
- Adding `deps` to about 80 cases across nine packages: noise in every case, and tools' rules stay silenced.
- No scope for rules: a long-lived process keeps reporting a dropped package's rules.

**Consequences.** `importDeps` records the packages it imported first; `check()` leaves out only their rules when out of scope. `packages/check/test/type-cache-session.test.ts`'s std-fake case is rewritten. A caller that imports a package after `importDeps` loaded it does not make its rules the caller's.
