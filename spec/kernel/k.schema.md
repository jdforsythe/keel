# k.schema: Schemas
status: conformance-covered

**API.**
```ts
import { s } from '@keel/schema'
export const User = s.object({ id: s.id('User'), name: s.string({ min: 1 }), role: s.enum(['admin','member']), email: s.string().optional() })
type User = s.infer<typeof User>
```
Primitives: `string` (`{ min, max }`; with `min` >= 1, `''` or only whitespace fails rule `required`; JSON Schema adds `pattern: "\\S"`), `number` (finite, `{ min, max }`), `int` (`{ min, max }`), `boolean`, `literal`, `enum` (`{ pathDefault }`: the value a leading path param leaves out of the URL, k.prefix), `id(brand)`, `object` (`{ closed: true }`), `array`, `union(key, variants)` or `union(members)`, `record`, `json` (any `JsonValue`). Modifiers: `optional()` (key may be absent) and `nullable()` (value may be null) are distinct. `s.secret` and `.pii(class)`: k.privacy. Registry: `s.register(name, type)` for stdlib types.

**Format types.** `s.format(name, base, { check, gen: { from, map } })` narrows `base` by a pure `check(v): boolean` (a throw is false) and brands its type `Format<T, name>`. `parse` runs `base`, then `check`; false fails with rule `format` at that path. `encode` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `decodeStrings` coerces as `base` does and then parses the format, so a value `check` refuses is a `format` issue; `doc()` is `name`; `gen` maps `gen(from)` through `map`, keeping values `parse` accepts. The node is `{ kind: 'format', name, base }`; `check` and `gen` stay in memory, so a serialized node keeps the name.

**Derivations.** `User.parse(x): Result<User, SchemaError>` validates any input, also the JSON `User.encode(v)` gives · `gen(User)` fast-check arbitrary (`import { gen } from '@keel/schema/gen'`) · `User.doc()`. For `s.secret` (k.privacy), `decodeStrings` reads the inner type, `gen` wraps a generated inner value and `doc()` is `secret<T>`. Pure, for `.pii()` marks: `piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, `path` dotted with `*` for an array item or record value, the class its nearest mark's; `piiValues(schema, value)` gives, for a valid encoded value, each non-empty string and number (as `String()`) under a marked path, a marked record's keys and a marked open object's undeclared keys and values.

`decodeStrings(FormData | URLSearchParams | Record<string, string | string[]>)` (object schemas) coerces string input: numbers from numeric strings; booleans from `true|on|1` / `false|off|0`, absent boolean is false; for an optional key `''` is absent, as is only whitespace for a `string` with `min` >= 1; arrays from repeated keys or `key[]`; nested objects by dotted keys; records from the remaining prefixed keys; literal/enum compared as strings. `parse` rejects own `__proto__`, `constructor`, `prototype` keys; `pathToString(path)` gives `users.0.name`.

**Closed objects and member unions.** `s.object(shape, { closed: true })` fails each own undeclared key with rule `unknown-key` at that key's path (open objects ignore them; `encode` drops them); `doc()` writes it `{| a: T |}`; JSON Schema derivations add `additionalProperties: false`; `decodeStrings` reads declared keys only. `s.union([a, b, ...])` (two or more members, no discriminant) accepts a value when the first member that accepts it does; when none does, the issues are the last member's. `encode` uses the first accepting member, `decodeStrings` the first member whose candidate parses; `gen` picks a member by seed; `doc()` is `a | b`; JSON Schema is `anyOf`.

**SchemaError** is the KeelError `schema.invalid` (k.errors): a plain value `{ code: 'schema.invalid', message, data: { issues: { path: (string | number)[], rule: Rule }[] } }`. `Rule` is closed: `type` · `finite` · `int` · `min` · `max` · `literal` · `enum` · `required` · `optional-null` (null given to an optional, non-nullable key) · `nullable-absent` (key absent for a nullable, non-optional key) · `discriminant` · `unknown-key` (an undeclared key of a closed object) · `secret-missing` (the marker where a secret is required) · `format` (a format type's `check` refused the value). Parse never throws; `encode` of an invalid value throws (unexpected). Re-registering a name with a different schema throws.

**Rules** (checker, on source). E1104 schema declared outside a `*.schema.ts` file · E1106 `s.format` in app code (format types are stdlib's).

**Conformance.**
- `parse(encode(v))` round-trips for every type but `secret`.
- A schema has no `decode`.
- `s.string({ min: 1 })` fails `''` and `' '` with rule `required`; `decodeStrings` drops both if optional.
- Generator produces only valid values.
- Parse rejects every invalid shape in the fixture set.
- Branded IDs are not assignable across brands.
- For every generated schema with marked nodes, `parse`, `encode`, `decodeStrings` and `gen` give what the unmarked schema gives.
- `piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object.
- For every generated value of a fixture schema, `piiValues` returns exactly the non-empty strings and the numbers under marked paths.
- For every generated valid value of an object schema of primitives, encoding to URLSearchParams then decodeStrings returns an equal value.
- For number and int with bounds, every generated value is within bounds and parse rejects values outside with rule min or max.
- Every generated json value round-trips and non-JSON values are rejected with rule type.
- Every generated value of a closed object round-trips, and adding an undeclared key fails with rule `unknown-key` at that key.
- Every generated value of a member union round-trips; a value no member accepts fails with the last member's issues.
- For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106.
