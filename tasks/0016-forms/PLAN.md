# Task 0016: forms

**Spec:** k.forms · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/forms

## Deliverables
- [x] `form(schema, { initial? })` handle: `field(path)`, `values()`, `errors()`, `error()`, `pending()`, `reset()`, router seam `pending.set`/`validate()`/`onResult(r)`
- [x] `Field`: `name`, `id`, `errorId`, `value()`, `error()`, `touched()`, `set(v)`, `blur()`, `bind(el)`
- [x] typed dotted paths (`FieldPath<T>`, `PathValue<T, P>`); runtime E1902
- [x] `toFormData(schema, value)`, inverse of `decodeStrings`
- [x] property tests (seed 1337); README contract; changeset `.changeset/forms-initial.md`
- [x] conformance green (after router commit bf6bd7a and RFC 0005 `s.int({ min, max })`)
- [x] spec status k.forms -> implemented (spec/kernel/k.forms.md, spec/00-map.md, README)

## Steps
1. [x] Deps: `@keel/schema`, `@keel/reactive`, `@keel/router` (workspace:*); dev `@keel/ctx`, `@keel/runtime-dom` (fixture imports).
2. [x] Implement; check; test (own tests green; conformance run against a scratch router stub, see V3).
3. [x] Properties; README; changeset; spec status -> implemented.
4. [x] Router exports landed: deleted local `src/internal/FormHandle.ts`; test/seam.test.ts imports `FormHandle` from `@keel/router`; conformance rerun green.

## Decisions
- D1: Handle type is `FormState<T>` (spec text: "creates form state"; `FormHandle` is the router's seam name). `form` is generic in the schema type `S` (fixture uses `form<typeof Note>`), returns `FormState<Infer<S>>`.
- D2: `field` signature `field<P extends FieldPath<T> | (string & {})>(path: string extends P ? P : P & FieldPath<T>)`. A literal path not in `FieldPath<T>` is a compile error; a computed `string` is accepted (returns `Field<unknown>`) and checked at runtime (E1902). Needed because conformance assigns `f.field` to `(path: string) => unknown` while also requiring the parameter type not to equal `string`.
- D3: `pending` is a callable signal: `(() => boolean) & Signal<boolean>`. `pending()` per spec; `pending.get/set` satisfy the router's `FormHandle.pending: Signal<boolean>`. The router sets it true/false; `onResult` also sets false.
- D4: `validate()` (seam) clears `error()`, validates every field, sets errors, focuses the first invalid *bound* element in document order (`compareDocumentPosition`). It does not set `pending`.
- D5: Values hold only schema-typed leaves. Element text is coerced per the decodeStrings table (`internal/coerceText.ts`); text that does not coerce (e.g. `12x` for an int) is kept in a separate raw map, absent from `values()`, merged back for validation so the issue is `type` at that path.
- D6: Absent required booleans are filled with `false` (decodeStrings: absent boolean is false) in `initial` and in the validation candidate; otherwise an untouched checkbox fails `required`.
- D7: Error messages: `internal/messageFor.ts`, rule plus constraint from the node at the issue path (`Must be at least 3 characters`, `Must be a number`, `Must be one of: a, b`, `Required`). An issue on a container is also reported on bound field paths beneath it.
- D8: `onResult`: `ok` -> `reset()`; `err` `keel.fields` -> errors = exactly its `data` string entries, `error()` cleared; any other `err` -> `error()` set, values and field errors unchanged. `error()` is provided because the brief asked for it; the router's `FormProps.error` slot may render from the Result directly (possible duplication, Principle 1: decide with the router task).
- D9: ids: `form<n>:<path>` and `form<n>:<path>:error`; `n` is a module counter per `form()` call. `name` is the dotted path so native FormData decodes by the schema.
- D10: `bind(el)`: sets `name`, `id` (not for radios), syncs value via an effect (does not rewrite text that already reads as the stored value, e.g. `1.`), listens to `input` and `blur`, keeps `aria-invalid` and the `errorId` token in `aria-describedby` (other ids kept). Unbind on the returned function or on dispose of `owner()` at bind time.
- D11: `toFormData` validates first and throws like `encode` on a value that does not fit. Encoding: numbers via `String` (`-0` as `-0`), booleans `true`/`false`, null as `''`, dotted keys for objects/records/union variants, repeated keys for arrays of leaves (indexed dotted keys otherwise). Not representable by decodeStrings: `''` in optional/nullable keys, empty arrays, empty nested objects, record keys with `.`.
- D13: The router seam type is `FormHandle` from `@keel/router` (exported from its index); forms keeps no copy. `FormState<T>` is checked assignable to it in test/seam.test.ts.
- D12: One `unsafe` (`unsafe/asSchemaValue.ts`): narrows stored values and the parse ok value to `Infer<S>`/`PathValue`; TS cannot relate a generic `S` to `Infer<S>`. Unsafe count 0 -> 1.

## Verification
- [x] conformance green · properties present · `pnpm --filter @keel/forms check` clean (tsc, biome) · structure-lint clean for forms · generate/docs-freshness/budgets ok
- Conformance skipped by design: E1901, E1903, E1904 (static diagnostics, k.check), 422 without runtime (k.server).
- Mutation: `mutate` script for forms is `echo skip`; threshold not measured.
- Unsafe count 0 -> 1 (D12, justified).

Test trailer (`pnpm --filter @keel/forms test`): `ok 33 tests, 0 failed, 4 skipped (1.8s)`

## Next action
review
