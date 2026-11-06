# Task 0002-0004: schema

**Spec:** k.schema · **Gate:** G1 · **Branch:** jdforsythe/test-impl · **Package:** packages/schema
Covers backlog 0002 (primitives), 0003 (parse/encode/decode/Result), 0004 (generators, docs, registry) as one package build (decision D6 in 0001).

## Deliverables
- [x] `s.string|number|int|boolean|literal|enum|id|object|array|union|record`; `.optional()` and `.nullable()` distinct
- [x] `parse -> Result<T, SchemaError>`, `encode/decode` JSON, `gen()` fast-check arbitrary, `doc()`
- [x] `s.infer`, branded ids not assignable across brands (type test)
- [x] `s.register(name, type)` registry (extension point)
- [x] `Result` type lives here (k.errors depends on schema; task 0019 extends); `ok`/`err` exported
- [x] k.errors pieces owned by schema: `KeelError`, `s.error(..).make`, `s.result(T, E)`, `attempt` (rfc:0000 spec change)
- [x] property tests per exported function; README contract; changeset

## Steps
1. [x] conformance-writer writes packages/schema/conformance from k.schema.
2. [x] Implement; `pnpm check`, `pnpm test --filter @keel/schema`.
3. [x] Property tests in test/; README; changeset; spec status -> implemented.

## Decisions
- D1: Own node descriptor tree (needed for gen/doc/codec); validation delegated per ADR-0010 only if it stays under 2 kB gz, else hand-written (~150 lines). Implementer records which.
  - **Outcome: hand-written.** Package is 2.4 kB gz minified (esbuild, fast-check external), ~510 lines across src/. A borrowed validator would still need the node tree for gen/doc/codec, so it adds bytes and a second source of truth.
- D2: `.optional()` is a key modifier only. Standalone it validates the inner type (undefined rejected). In an object, absent means `!Object.hasOwn`; a present key holding `undefined` fails rule `type` (matches `exactOptionalPropertyTypes`). Modifier nodes are canonical: `optional` outermost, both idempotent, order irrelevant.
- D3: parse/decode return the input by reference when valid (no copy). Unknown object keys are accepted by parse and dropped by encode. decode is parse while every type is JSON-native.
- D4: `encode(value: unknown)`, forced by conformance round-trip.test.ts (calls `encode` on a union of schema types). encode validates first; on invalid input it throws a plain `Error` whose message lists up to 5 issues (`schema.invalid: type at name; ...`), because that path is unexpected (k.errors).
- D5 (revised after rfc:0000 spec change): `SchemaError` is a type only: the KeelError `{ code: 'schema.invalid', message, data: { issues: { path, rule }[] } }`, `rule` from the closed k.schema `Rule` union (`src/internal/Rule.ts`, not exported; reachable as `SchemaError['data']['issues'][number]['rule']`). parse collects every issue (all failing fields and items, in declaration order), so k.forms can map them to fields. `message` summarises the first issue, < 90 chars. E1100/E1101/E1102 are gone from the runtime (they are checker diagnostics, task 0020).
- D6: `number` is finite (`type` vs `finite`), `int` is `Number.isSafeInteger` (`type` vs `int`), `id` is a non-empty string (`min`).
- D7: union variants must be object schemas with a unique literal at the key; construction throws a plain `Error` otherwise (programmer error). A missing, unknown or wrongly-typed discriminant is one issue, rule `discriminant`, at path `[key]`.
- D8 (aligned with spec "Re-registering a name with a different schema throws"): same name + same schema is a no-op; a different schema throws a plain `Error` (no code). `s.registry()` returns a snapshot `Map`.
- D9: `s` is a const object merged with `declare namespace s { type infer<S> }`. `Schema.node` is public (for `keel explain` and forms); the `Node` type is not exported yet.
- D10: The only unknown->T step is one type guard in `src/internal/make.ts` (no casts, unsafe count 0). `gen()` is `arbitrary(node).filter(guard)`, so every sample is checked.
- D11: `KeelError<C, D>` = `{ readonly code: C; readonly message: string; readonly data: D }`. `s.error(code, D)` is an object schema `{ code: literal, message: string, data: D }` typed as `KeelError<C, Infer<D>>`, plus `.make(data, message = code)` (no runtime validation of `data`; the type covers it).
- D12: `s.result(T, E)` is a union node on `ok` with variants `{ ok: true, value: T }` / `{ ok: false, error: E }`, so codec, gen and doc come from the existing walkers. Typed as `Result<Infer<T>, Infer<E>>`.
- D13: `attempt(fn)`: a sync fn gives a `Result` synchronously; a fn returning a thenable gives `Promise<Result>` that never rejects. Return type `[T] extends [never] ? Result<never, U> : T extends PromiseLike<V> ? Promise<Result<V, U>> : Result<T, U>`, where U = `KeelError<'keel.unexpected', { cause: string }>`. `cause` is `Name: message` for Errors, else the string or JSON of the thrown value; `message` is the cause clipped to 89 chars.
- D14 (rfc:0002): `decodeStrings` exists only on `s.object(..)` schemas (type `ObjectSchema<T>`; `.optional()`/`.nullable()` return plain `Schema`). It reshapes input into a candidate value (`src/internal/fromStrings.ts`, `leafFromString.ts`, `stringEntries.ts`) then calls `parse`, so all rules come from one checker. Text that cannot be coerced is left unchanged and surfaces as `type`/`literal`/`enum`/`int`. Required array/record/object with no keys is `required`. File entries in FormData are ignored. Nullable key absent or empty gives null; an optional boolean absent is absent (optional wins over checkbox semantics), a plain or nullable boolean absent is false. `decode` stays the JSON inverse of `encode`.
- D15: `parse` rejects an object, record or union value with an own `__proto__`, `constructor` or `prototype` key (rule `type` at the object's path), via `src/internal/hasProtoKey.ts`. A schema declaring such a field name can never validate. Parse still returns the input by reference; encode still drops unknown keys (documented in README).
- D16: `s.string({ min, max })` with `min > max` throws a plain `Error` at construction (programmer error, like `union`).
- D17: `pathToString(path)` is `path.join('.')`, exported from `src/pathToString.ts`; `invalid()` reuses it.
- D18: `packages/schema/unsafe/unsafe.ts` had no callers and was deleted (dir kept with `.gitkeep`); `tooling/ledger/ledger.json` regenerated so the baseline records unsafe = 1 (ctx, PLAN 0009 D10). Schema's own unsafe count stays 0.
- D19 (rfc:0005): `s.number({ min?, max? })` and `s.int({ min?, max? })`, inclusive. Nodes carry `min`/`max` only when set. Construction throws on non-finite bounds, `min > max`, or (int) a range with no integer. Failing bound gives rule `min`/`max` after `type`/`finite`/`int`. `gen()` uses `fc.double`/`fc.integer` with the bounds; `doc()` renders `int(0..1000)`. `decodeStrings` unchanged.
- D20 (rfc:0006): generators moved to the `@keel/schema/gen` subpath: `gen(schema): fc.Arbitrary<T>` (output unchanged: `arbitrary(node).filter(parse ok)`); `.gen()` removed from `Schema`/`make`. `arbitrary` is now private to `src/gen.ts`, the only file importing `fast-check`; fast-check is a peerDependency (+ devDependency). `exports["./gen"]` added. Index bundle (esbuild min+gzip) 29.7 kB -> 3.2 kB. `tsconfig.build.json` gained `rewriteRelativeImportExtensions` (build previously raised TS5097, as in other packages). All callers migrated mechanically.

## Verification
- [x] conformance green (129 tests incl. result.test.ts) · properties present · `pnpm --filter @keel/schema check` clean · unsafe count 0 in schema
- [ ] root `pnpm check`: red outside schema. turbo check fails in packages/store (its new conformance imports `@keel/schema`/`@keel/reactive`, which store/package.json does not declare as workspace deps); structure-lint S0004 only in packages/compiler/conformance. Schema conformance is now lint-clean; generate passes.
- [ ] root `pnpm test`: schema green; packages/store conformance cannot resolve `@keel/schema`/`@keel/reactive` (same missing deps; store task)
- [ ] mutation: package `mutate` script is `echo skip`; not measured

Test trailer (`pnpm --filter @keel/schema test`):
```
ok 242 tests, 0 failed, 0 skipped (0.5s)
```

## Next action
review
