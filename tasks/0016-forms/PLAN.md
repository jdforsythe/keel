# Task 0016: forms

**Spec:** k.forms · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/forms

## Deliverables
- [x] `form(schema, { initial? })` handle: `field(path)`, `values()`, `errors()`, `error()`, `pending()`, `reset()`, router seam `pending.set`/`validate()`/`onResult(r)`
- [x] `Field`: `name`, `id`, `errorId`, `value()`, `error()`, `touched()`, `set(v)`, `blur()`, `bind(el)`
- [x] typed dotted paths (`FieldPath<T>`, `PathValue<T, P>`); runtime E1902
- [x] `toFormData(schema, value)`, inverse of `decodeStrings`
- [x] property tests (seed 1337); README contract; changeset `.changeset/forms-initial.md`
- [ ] conformance green (blocked: @keel/router exports; fixture `s.int({ min: 0 })`, see Verification)
- [ ] spec status k.forms -> implemented (only once conformance is green)

## Steps
1. [x] Deps: `@keel/schema`, `@keel/reactive`, `@keel/router` (workspace:*); dev `@keel/ctx`, `@keel/runtime-dom` (fixture imports).
2. [x] Implement; check; test (own tests green; conformance run against a scratch router stub, see V3).
3. [x] Properties; README; changeset. Spec status left `proposed`.
4. [ ] When @keel/router exports `Form`, `action`, `createRouter`, `manifest`, `FormHandle`: replace `src/internal/FormHandle.ts` with `import type { FormHandle } from "@keel/router"` in test/seam.test.ts, rerun conformance.

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
- D12: One `unsafe` (`unsafe/asSchemaValue.ts`): narrows stored values and the parse ok value to `Infer<S>`/`PathValue`; TS cannot relate a generic `S` to `Infer<S>`. Unsafe count 0 -> 1.

## Verification
- V1: `pnpm --filter @keel/forms check`: src/test/unsafe clean (tsc + biome); remaining tsc errors are all in `conformance/fixtures.ts`: TS2305 x4 (`Form`, `action`, `createRouter`, `manifest` not exported by @keel/router yet) and TS2554 at fixtures.ts:20 (`s.int({ min: 0 })`; `s.int()` takes no options).
- V2: own tests `npx vitest run test/`: `ok 20 tests, 0 failed, 0 skipped (0.6s)`. Package trailer (`pnpm --filter @keel/forms test`): `fail 33 tests, 16 failed, 4 skipped (1.1s)`; the failures are the 8 router-dependent conformance tests (`action is not a function`).
- V3: conformance run (scratch, nothing in repo) with a throwaway router stub aliased for `@keel/router`: 1 failing property per age case, all caused by fixture `age: s.int({ min: 0 })` + `INVALID.age = "-1"` (schema ignores the option, -1 is valid). With a scratch copy where `INVALID.age = "x"`: `9 passed | 4 skipped`.
- Green in repo now: `formdata-roundtrip`. Skipped by design: E1901, E1903, E1904, 422 (server).
- Structure lint: no forms findings. Budgets: ok.
- Mutation: `mutate` script is `echo skip`; not measured.

## Next action
wait for @keel/router exports, then step 4; resolve the fixture `s.int({ min: 0 })` mismatch (rfc: add int min/max to k.schema, or rfc: change fixture INVALID.age to non-numeric) before flipping k.forms to implemented.
