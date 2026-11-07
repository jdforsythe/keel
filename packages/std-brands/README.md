# @keel/std-brands

**Spec:** std.brands · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:** `idBrandCase`, the `RuleDef` for E2101 (registered on import).
- **Invariants:** E2101 flags each `s.id(x)` and `<expr>.random.id(x)` whose literal `x` is not `^[A-Z][A-Za-z0-9]*$`, at the literal. `fix` replaces the literal with its PascalCase form in the same quotes; there is no fix when that form is empty or digit-led. Pure and deterministic (k.check).
- **Dependencies:** `@keel/check`, `oxc-parser`.
- **Rungs:** conformance (example + probabilistic, fix applied with `git apply`), properties for `pascalCase`.

## Extension points

Uses the **check rule registry** (k.check `defineRule`), including `fix`.

## Unsafe

count: 0
