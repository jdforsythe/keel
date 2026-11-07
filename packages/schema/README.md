# @keel/schema

**Spec:** k.schema, k.errors (Result, KeelError, attempt) · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `s.string({min,max}) | number({min,max}) | int({min,max}) | boolean() | literal(v) | enum([..]) | id(brand) | object({..}, { closed? }) | array(T) | union(key, [..]) | union([A, B, ..]) | record(T) | secret(T) | error(code, D) | result(T, E)`; `reveal(secret)` (rfc:0026); modifiers `.optional()` (key may be absent), `.nullable()` (value may be null). Each schema: `parse`/`decode` -> `Result<T, SchemaError>`, `encode` -> `JsonValue`, `doc()`, `node`. Generators: `gen(schema)` from `@keel/schema/gen` (rfc:0006). `s.error(..).make(data, message?)`. `s.infer`, `s.register`, `s.registry()`. `ok`, `err`, `attempt(fn)`. `pathToString(path)` (`users.0.name`). `s.object(..)` schemas also have `decodeStrings(FormData | URLSearchParams | Record<string, string | string[]>)`. Types `Result`, `KeelError`, `SchemaError`, `Schema`, `Infer`, `JsonValue`, `Secret`.
- **Invariants:** parse/decode/attempt never throw. `SchemaError` is the plain KeelError `schema.invalid` listing every issue `{ path, rule }`, `rule` from a closed set; no E-codes at runtime. Valid input is returned by reference (not copied; mutating it afterwards mutates the parsed value), except that a schema containing `s.secret` copies the containers above each secret it wraps. `Secret<T>` prints, serializes and inspects only as `"[secret]"`; `encode` gives the marker; parsing the marker fails with rule `secret-missing`; `reveal` is the only read path. `parse` rejects an object with an own `__proto__`, `constructor` or `prototype` key (rule `type` at its path). `s.string({min,max})`, `s.number({min,max})` and `s.int({min,max})` throw at construction when `min > max`; number/int bounds are inclusive (rules `min`/`max`, after `type`/`finite`/`int`). `s.json()` (rfc:0018) accepts exactly JSON-representable values (finite numbers, plain objects/arrays, no cycles or prototype keys; else rule `type`), encode/decode are identity, `decodeStrings` parses the text as JSON. `parse` keeps undeclared keys (a `{ closed: true }` object reports each with rule `unknown-key` instead, rfc:0029); `union([..])` accepts with the first accepting member, else reports the last member's issues; `encode` keeps declared keys only (unknown keys are dropped) (absent stays absent, null stays null) and throws an `Error` on invalid input. `decode` is the JSON codec inverse of `encode` (`decode(encode(v))` equals `v`, except secrets), not a string coercer; `decodeStrings` coerces form/URL text: numbers from numeric strings, booleans from `true|on|1` / `false|off|0` (absent boolean is false), empty string for an optional key is absent, arrays from repeated keys or `key[]`, nested objects by `a.b` keys, records from `prefix.key`, unions by discriminant; text that cannot be coerced is left as is and reported by validation (`type`, `literal`, ...); every `gen(schema)` sample parses. `attempt` maps throws/rejections to `keel.unexpected`.
- **Dependencies:** `fast-check` is a peer dependency, imported only by `@keel/schema/gen` (`src/gen.ts`); the main entry is 3.2 kB gz and never loads it. Hand-written validator.
- **Rungs:** probabilistic: conformance and `test/` properties, seed 1337. Inference: `expectTypeOf` under `tsc`.

## Extension points

`s.register(name, schema)`: same schema again is a no-op; a different schema under a taken name throws. `s.registry()` returns a snapshot `Map`.

## Unsafe

count: 0
