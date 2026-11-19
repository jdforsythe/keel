# @keel/std-brands

**Spec:** std.brands · **Status:** conformance-covered · **verified:** (none)

## Contract

- **Public API:**
  - `@keel/std-brands/tools` (node): `idBrandCase`, the `RuleDef` for E2101, registered on import. `keel check` and `keel build` load it for a project with `@keel/std-brands` in a module's `deps`.
  - `@keel/std-brands`: exports nothing and imports nothing. The package is CLI-time whole.
- **Invariants:** E2101 flags each `s.id(x)` and `<expr>.random.id(x)` whose literal `x` is not `^[A-Z][A-Za-z0-9]*$`, at the literal. `fix` replaces the literal with its PascalCase form in the same quotes; there is no fix when that form is empty or digit-led. Pure and deterministic (k.check).
- **Dependencies:** the tools entry: `@keel/check`, `oxc-parser`.
- **Rungs:** conformance (example + probabilistic, fix applied with `git apply`), properties for `pascalCase`.

## Extension points

Uses the **check rule registry** (k.check `defineRule`), including `fix`.

## Migration

`import { idBrandCase } from '@keel/std-brands'` becomes `from '@keel/std-brands/tools'`. A project that lists the package in a module's `deps` needs no change.

## Unsafe

count: 0
