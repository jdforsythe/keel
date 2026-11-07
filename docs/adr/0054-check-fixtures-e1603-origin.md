# ADR-0054: `reportedCodes()` decides which codes need a check fixture, and E1603 follows a URL or constructor to its origin (RFC 0065)

**Status:** accepted

**Context.**
- k.check asked for a fixture for every kernel Rules code. 38 had none, and 36 of those come from another command (build, cli, runtime, scaffold, harness), so the clause could never pass (backlog 0173).
- E1603 read only the outermost form of an `import()`/`Worker` argument and stopped one prototype step above a function (backlog 0177).

**Decision.**
- `@keel/check` exports `reportedCodes()`: the pipeline's codes plus every registered rule's. A code in it needs a fixture that triggers exactly that code. E1756 instead gets a registered rule that throws. Any other Rules code must be asserted by its own package's conformance: the test reads the assertion lines of `packages/*/conformance`, with comments and test titles removed (backlog 0186). E1049, E1801, E1807 and E1902 gained coded assertions.
- E1804 (`lowContrast`) and E1401-E1404 get fixtures. No code moves out of Rules. k.check becomes `conformance-covered`.
- E1603 follows a URL to its origin: `String()`, `toString()`, `new URL`, `.href`, a template or `+` led by it, `?:`/`&&`/`||`/`??`, object literal properties, every value a local's binding is given (the resolver's new `sameBinding`; backlog 0187), and `Reflect.construct(Worker, [u])`.
- A function value counts as the `Function` family for two prototype steps if it is async or a generator and one step otherwise. `.constructor` of a value with a step left is the `Function` constructor family.
- The walk lives in the rule, not in the shared resolver. It answers which URL a value holds; the resolver answers which global a name denotes.

**Alternatives.**
- Move the runtime codes out of Rules. That scatters them and makes none checkable.
- Keep the hand list of explain-only codes. It drifted.
- Report every `URL.createObjectURL` or non-constant `import()`. That flags downloads and data-built paths.

**Consequences.**
- `@keel/check` grows from 28,976 to 29,871 B gzip, inside its 30 kB budget.
- Not covered: values that flow through calls or other files, class `prototype` methods, and `+=`.
