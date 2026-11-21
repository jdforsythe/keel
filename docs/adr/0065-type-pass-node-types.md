# ADR-0065: the type pass loads Node's types when the project has them (RFC 0076)

**Status:** accepted (2026-11-10), under the WORKFLOW RFC defaults 1 and 3.

**Context.** `keel check` type-checks with no ambient `@types`. A node entry and tests need Node's types, and they reached the program only through the types of an imported dependency. With a test runner whose types do not reference `node`, a node entry reports E1751 under `keel check` while `tsc` passes.

**Decision.** The type pass resolves the `node` type reference from the project root and, when it resolves, adds that declaration file to the program. No other ambient package is loaded. The new-project template lists `@types/node`.

**Alternatives.**
- A reference directive per file, rejected: a migration for every app and a line nothing prompts the author to write.
- Gating on a node deployable in `topology.ts`, rejected: client-only projects have tests that use `node:` modules.
- Loading every visible `@types` package, rejected: the result would depend on workspace hoisting.

**Consequences.**
- k.check gains one sentence and one conformance clause.
- A project with `@types/node` sees Node's globals in every file of the type pass, client modules included; the ambient rules (E1601, E1603) remain the guard on what app code may use.
- A project without `@types/node` reports E1751 on Node names.
