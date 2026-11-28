# ADR-0188: k.leave: E1107 reads its own reach, narrower than k.boundary's (RFC 0166)

**Status:** accepted (orchestrator, under the RFC defaults).

**Context.** k.leave, k.boundary and k.bundle said E1107 uses E1004's reach, which counts every non-server file of a served module. `@keel/check` and its conformance use a narrower one, from component files by relative imports, and expect golden-2's server-only `.pii()` stores to be clean.

**Decision.** E1107's reach is stated in k.leave: a `.tsx` or `.jsx` file not named `*.server.*`, and files one reaches by relative `import`, `export … from` and literal `import()` through no `*.server.*` file. k.boundary and k.bundle name only E1004 and E1571. The limits (a `stores()` lookup by id, a package import) are stated.

**Alternatives.** The shared reach with the test changed (over-reports stores that never reach a page); a reach from island roots (needs a render-time fact).

**Consequences.** Spec and test agree; no code changes. One test header is retagged.
