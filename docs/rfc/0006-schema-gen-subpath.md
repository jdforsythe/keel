# RFC 0006: schema: generators on a subpath

Status: implemented

## Problem
`@keel/schema` imports `fast-check` statically to implement `.gen()` on every schema, so every app bundle ships fast-check (about 90 kB minified, 30 kB gzip) although generators are only used in tests. The schema core is 3.5 kB gzip without it.

## Proposal
- New subpath `@keel/schema/gen` exporting `gen(schema): fc.Arbitrary<T>`; the output is unchanged (valid values only, bounds respected).
- Remove `gen()` from the `Schema` interface and from every schema.
- `fast-check` becomes a `peerDependency` of `@keel/schema` (kept as a devDependency) and is imported only by `src/gen.ts`.
- `package.json` gains `exports["./gen"]`.

## Alternatives
- Dynamic `import('fast-check')` inside `.gen()`: makes `gen` async and still bundles a chunk.
- Rely on tree-shaking: methods on a returned object are not shakeable.
- Separate `@keel/schema-gen` package: new kernel package for one function.

## Spec diff
spec/kernel/k.schema.md: Derivations line reads `gen(User)` from `@keel/schema/gen`; Conformance wording for generators refers to `gen(schema)`.

## Conformance diff
Existing schema, forms and router conformance files replace `X.gen()` with `gen(X)` and import it from `@keel/schema/gen`. No assertion changes.

## Migration
Mechanical: `X.gen()` becomes `gen(X)` plus `import { gen } from '@keel/schema/gen'`. Packages that import fast-check for tests already declare it.

## Token impact
Neutral in k.schema; saves about 26 kB gzip per app bundle.
