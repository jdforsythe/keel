# Task 0016: forms

**Spec:** k.forms · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/forms

## Deliverables
- [ ] `form(schema, { initial? })` handle: `field(path)`, `values()`, `errors()`, `error()`, `pending()`, `reset()`, router seam `validate()`/`onResult(r)`
- [ ] `Field`: `name`, `id`, `errorId`, `value()`, `error()`, `touched()`, `set(v)`, `blur()`, `bind(el)`
- [ ] typed dotted paths (`FieldPath<T>`, `PathValue<T, P>`); runtime E1902
- [ ] `toFormData(schema, value)`, inverse of `decodeStrings`
- [ ] property tests (seed 1337); README contract; changeset

## Steps
1. [ ] Deps (`@keel/schema`, `@keel/reactive`, `@keel/router`; dev `@keel/ctx`, `@keel/runtime-dom`).
2. [ ] Implement; check; test.
3. [ ] Properties; README; changeset; spec status (only if conformance all green).

## Decisions

## Verification

## Next action
implement src/
