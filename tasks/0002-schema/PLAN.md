# Task 0002-0004: schema

**Spec:** k.schema · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/schema
Covers backlog 0002 (primitives), 0003 (parse/encode/decode/Result), 0004 (generators, docs, registry) as one package build (decision D6 in 0001).

## Deliverables
- [ ] `s.string|number|int|boolean|literal|enum|id|object|array|union|record`; `.optional()` and `.nullable()` distinct
- [ ] `parse -> Result<T, SchemaError>`, `encode/decode` JSON, `gen()` fast-check arbitrary, `doc()`
- [ ] `s.infer`, branded ids not assignable across brands (type test)
- [ ] `s.register(name, type)` registry (extension point)
- [ ] `Result` type lives here (k.errors depends on schema; task 0019 extends)
- [ ] property tests per exported function; README contract; changeset

## Steps
1. conformance-writer writes packages/schema/conformance from k.schema.
2. Implement; `pnpm check`, `pnpm test --filter @keel/schema`.
3. Property tests in test/; README; changeset; spec status -> implemented.

## Decisions
- D1: Own node descriptor tree (needed for gen/doc/codec); validation delegated per ADR-0010 only if it stays under 2 kB gz, else hand-written (~150 lines). Implementer records which.

## Verification
- [ ] conformance green · properties present · `pnpm check` clean · unsafe count 0 or justified

## Next action
Step 1.
