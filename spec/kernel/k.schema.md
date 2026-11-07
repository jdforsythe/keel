# k.schema: Schemas
status: implemented

**Purpose.** One declaration per data shape. Everything derives from it.

**API.**
```ts
import { s } from '@keel/schema'
export const User = s.object({ id: s.id('User'), name: s.string({ min: 1 }), role: s.enum(['admin','member']), email: s.string().optional() })
type User = s.infer<typeof User>
```
Primitives: `string`, `number` (finite, `{ min, max }`), `int` (`{ min, max }`), `boolean`, `literal`, `enum`, `id(brand)`, `object` (`{ closed: true }`), `array`, `union(key, variants)` (discriminated) or `union(members)`, `record`, `json` (any `JsonValue`; non-JSON values fail with rule `type`; rfc:0018). Modifiers: `optional()` (key may be absent) and `nullable()` (value may be null) are distinct. Registry: `s.register(name, type)` for stdlib types.

**Derivations.** `User.parse(x): Result<User, SchemaError>` validates any input, also the JSON `User.encode(v)` gives (no `decode`; rfc:0043) · `gen(User)` fast-check arbitrary (`import { gen } from '@keel/schema/gen'`; fast-check is a peer dependency, absent from app bundles) · `User.doc()`.

`decodeStrings(FormData | URLSearchParams | Record<string, string | string[]>)` (object schemas) coerces string input: numbers from numeric strings; booleans from `true|on|1` / `false|off|0`, absent boolean is false; empty string for an optional key is absent; arrays from repeated keys or `key[]`; nested objects by dotted keys; records from the remaining prefixed keys; literal/enum compared as strings. `parse` rejects own `__proto__`, `constructor`, `prototype` keys; `pathToString(path)` gives `users.0.name`.

**Secrets** (rfc:0026). `s.secret(inner)` parses a raw `inner` value, or an existing secret, to a `Secret<T>` whose value is read only by `reveal(secret): T` (E1105). A secret never serializes: `encode`, `JSON.stringify`, `String()`, template literals and `util.inspect` give the marker `"[secret]"`; it has no own enumerable keys, so spread and `structuredClone` copy nothing. `parse` of the marker fails with rule `secret-missing`, so a store snapshot, `#k-state`, log or session capture never carries or restores the value. `decodeStrings` reads the inner type. `gen` wraps a generated inner value; `doc()` is `secret<T>`.

**Closed objects and member unions** (rfc:0029). `s.object(shape, { closed: true })` fails each own undeclared key with rule `unknown-key` at that key's path (open objects ignore them; `encode` drops them); `doc()` writes it `{| a: T |}`; JSON Schema derivations add `additionalProperties: false`; `decodeStrings` reads declared keys only. `s.union([a, b, ...])` (two or more members, no discriminant) accepts a value when the first member that accepts it does; when none does, the issues are the last member's. `encode` uses the first accepting member, `decodeStrings` the first member whose candidate parses; `gen` picks a member by seed; `doc()` is `a | b`; JSON Schema is `anyOf`. Members that are all tagged objects use `union(key, variants)`.

**SchemaError** is the KeelError `schema.invalid` (k.errors): a plain value `{ code: 'schema.invalid', message, data: { issues: { path: (string | number)[], rule: Rule }[] } }`. `Rule` is closed: `type` · `finite` · `int` · `min` · `max` · `literal` · `enum` · `required` · `optional-null` (null given to an optional, non-nullable key) · `nullable-absent` (key absent for a nullable, non-optional key) · `discriminant` · `unknown-key` (an undeclared key of a closed object) · `secret-missing` (the marker where a secret is required). Parse never throws; `encode` of an invalid value throws (unexpected). Re-registering a name with a different schema throws.

**Rules** (checker, on source; never runtime codes). E1104 schema declared outside a `*.schema.ts` file · E1105 `reveal` imported in an app file other than `*.server.ts` (rfc:0026).

**Conformance.**
- `parse(encode(v))` round-trips for every type but `secret`.
- A schema has no `decode`.
- Generator produces only valid values.
- Parse rejects every invalid shape in the fixture set.
- Branded IDs are not assignable across brands.
- For every generated valid value of an object schema of primitives, encoding to URLSearchParams then decodeStrings returns an equal value.
- For number and int with bounds, every generated value is within bounds and parse rejects values outside with rule min or max.
- Every generated json value round-trips and non-JSON values are rejected with rule type.
- For every generated secret: it parses; `encode`, `String` and `util.inspect` give the marker, `JSON.stringify` the marker's JSON, `structuredClone` an empty object; parsing a raw value yields a secret revealing it; the marker fails with rule `secret-missing`.
- Every generated value of a closed object round-trips, and adding an undeclared key fails with rule `unknown-key` at that key.
- Every generated value of a member union round-trips; a value no member accepts fails with the last member's issues.
