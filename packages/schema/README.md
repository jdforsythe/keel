# @keel/schema

**Spec:** k.schema, k.errors (Result, KeelError, attempt) · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `s.string({min,max}) | number() | int() | boolean() | literal(v) | enum([..]) | id(brand) | object({..}) | array(T) | union(key, [..]) | record(T) | error(code, D) | result(T, E)`; modifiers `.optional()` (key may be absent), `.nullable()` (value may be null). Each schema: `parse`/`decode` -> `Result<T, SchemaError>`, `encode` -> `JsonValue`, `gen()`, `doc()`, `node`. `s.error(..).make(data, message?)`. `s.infer`, `s.register`, `s.registry()`. `ok`, `err`, `attempt(fn)`. Types `Result`, `KeelError`, `SchemaError`, `Schema`, `Infer`, `JsonValue`.
- **Invariants:** parse/decode/attempt never throw. `SchemaError` is the plain KeelError `schema.invalid` listing every issue `{ path, rule }`, `rule` from a closed set; no E-codes at runtime. Valid input is returned by reference. `encode` keeps declared keys only (absent stays absent, null stays null) and throws an `Error` on invalid input. `decode(encode(v))` equals `v`; every `gen()` sample parses. `attempt` maps throws/rejections to `keel.unexpected`.
- **Dependencies:** `fast-check` (only for `gen()`). Hand-written validator, 2.4 kB gz without fast-check.
- **Rungs:** probabilistic: conformance and `test/` properties, seed 1337. Inference: `expectTypeOf` under `tsc`.

## Extension points

`s.register(name, schema)`: same schema again is a no-op; a different schema under a taken name throws. `s.registry()` returns a snapshot `Map`.

## Unsafe

count: 0
