# @keel/schema

**Spec:** k.schema, k.errors (Result, KeelError, attempt) · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `s.string({min,max}) | number() | int() | boolean() | literal(v) | enum([..]) | id(brand) | object({..}) | array(T) | union(key, [..]) | record(T) | error(code, D) | result(T, E)`; modifiers `.optional()` (key may be absent), `.nullable()` (value may be null). Each schema: `parse`/`decode` -> `Result<T, SchemaError>`, `encode` -> `JsonValue`, `gen()`, `doc()`, `node`. `s.error(..).make(data, message?)`. `s.infer`, `s.register`, `s.registry()`. `ok`, `err`, `attempt(fn)`. `pathToString(path)` (`users.0.name`). `s.object(..)` schemas also have `decodeStrings(FormData | URLSearchParams | Record<string, string | string[]>)`. Types `Result`, `KeelError`, `SchemaError`, `Schema`, `Infer`, `JsonValue`.
- **Invariants:** parse/decode/attempt never throw. `SchemaError` is the plain KeelError `schema.invalid` listing every issue `{ path, rule }`, `rule` from a closed set; no E-codes at runtime. Valid input is returned by reference (not copied; mutating it afterwards mutates the parsed value). `parse` rejects an object with an own `__proto__`, `constructor` or `prototype` key (rule `type` at its path). `s.string({min,max})` throws at construction when `min > max`. `encode` keeps declared keys only (unknown keys are dropped) (absent stays absent, null stays null) and throws an `Error` on invalid input. `decode` is the JSON codec inverse of `encode` (`decode(encode(v))` equals `v`), not a string coercer; `decodeStrings` coerces form/URL text: numbers from numeric strings, booleans from `true|on|1` / `false|off|0` (absent boolean is false), empty string for an optional key is absent, arrays from repeated keys or `key[]`, nested objects by `a.b` keys, records from `prefix.key`, unions by discriminant; text that cannot be coerced is left as is and reported by validation (`type`, `literal`, ...); every `gen()` sample parses. `attempt` maps throws/rejections to `keel.unexpected`.
- **Dependencies:** `fast-check` (only for `gen()`). Hand-written validator, 2.4 kB gz without fast-check.
- **Rungs:** probabilistic: conformance and `test/` properties, seed 1337. Inference: `expectTypeOf` under `tsc`.

## Extension points

`s.register(name, schema)`: same schema again is a no-op; a different schema under a taken name throws. `s.registry()` returns a snapshot `Map`.

## Unsafe

count: 0
