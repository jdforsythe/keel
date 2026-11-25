# k.schema: Schemas
status: implemented

**API.**
```ts
import { s } from '@keel/schema'
export const User = s.object({ id: s.id('User'), name: s.string({ min: 1 }), role: s.enum(['admin','member']), email: s.string().optional() })
type User = s.infer<typeof User>
```
Primitives: `string` (`{ min, max }`; with `min` >= 1, a blank value fails rule `required` (no character outside `White_Space`, `Default_Ignorable_Code_Point`, `Cc`, `Cf`, `Cs`, `M`, U+2800); JSON Schema adds a `pattern` of `\u` ranges for its BMP part but `M` and `Cs`, read alike by ECMA-262 and Python), `number` (finite, `{ min, max }`), `int` (`{ min, max }`), `boolean`, `literal`, `enum` (`{ pathDefault }`: the value a leading path param leaves out of the URL, k.prefix), `id(brand)`, `object` (`{ closed: true }`), `array`, `union(key, variants)` or `union(members)`, `record`, `json` (any `JsonValue`). Modifiers: `optional()` (key may be absent) and `nullable()` (value may be null) are distinct. `s.secret` and `.pii(class)`: k.privacy. `s.format`: k.formats. Registry: `s.register(name, type)` for stdlib types.

**Derivations.** `User.parse(x): Result<User, SchemaError>` validates any input, also the JSON `User.encode(v)` gives · `gen(User)` fast-check arbitrary (`import { gen } from '@keel/schema/gen'`) · `User.doc()`. For `s.secret` (k.privacy), `decodeStrings` reads the inner type, `gen` wraps a generated inner value and `doc()` is `secret<T>`. Pure, for `.pii()` marks: `piiPaths(schema)` lists `{ path, class }` per marked leaf in declaration order, a marked open object's undeclared keys as `*` after its fields, `path` dotted with `*` for an array item or record value, the class its nearest mark's (a lookup gives a declared path its nearest mark's class, and an object's undeclared key, open or closed, and all under it, the class in force at the object; `*` covers no declared key); `piiValues(schema, value)` gives, for a valid encoded value, each non-empty string and number (as `String()`) under a marked path, a marked record's keys and a marked open object's undeclared keys and values.

`decodeStrings(FormData | URLSearchParams | Record<string, string | string[]>)` (object schemas) coerces string input: numbers from numeric strings; booleans from `true|on|1` / `false|off|0`, absent boolean is false; for an optional key `''` is absent, as is a blank value for a `string` with `min` >= 1; arrays from repeated keys or `key[]`; nested objects by dotted keys; records from the remaining prefixed keys; literal/enum compared as strings. `parse` rejects own `__proto__`, `constructor`, `prototype` keys; `pathToString(path)` gives `users.0.name`.

**Closed objects and member unions.** `s.object(shape, { closed: true })` fails each own undeclared key with rule `unknown-key` at that key's path (open objects ignore them, but fail rule `type` at a `Secret` anywhere under one; `encode` drops them); `doc()` writes it `{| a: T |}`; JSON Schema derivations add `additionalProperties: false`; `decodeStrings` reads declared keys only. `s.union([a, b, ...])` (two or more members, no discriminant) accepts a value when the first member that accepts it does; when none does, the issues are the last member's. `encode` uses the first accepting member, `decodeStrings` the first member whose candidate parses; `gen` picks a member by seed; `doc()` is `a | b`; JSON Schema is `anyOf`.

**SchemaError** is the KeelError `schema.invalid` (k.errors): with `data: { issues: { path: (string | number)[], rule: Rule }[] }`. `Rule` is closed: `type` · `finite` · `int` · `min` · `max` · `literal` · `enum` · `required` · `optional-null` (null given to an optional, non-nullable key) · `nullable-absent` (key absent for a nullable, non-optional key) · `discriminant` · `unknown-key` (an undeclared key of a closed object) · `secret-missing` (the marker where a secret is required) · `format` (a format type's `check` refused the value). Parse never throws; `encode` of an invalid value throws (unexpected). Re-registering a name with a different schema throws.

**Frozen.** The `s` namespace, every schema `@keel/schema` makes and its `node`, with every object and array under it, are frozen when made, so in a module an assignment, a `delete` or an `Object.defineProperty` that would change one throws a `TypeError` and the schema stays as made; static reads of a schema (k.privacy-reads) rest on it.

**Rules** (checker, on source). E1104 schema declared outside a `*.schema.ts` file · E1106 `s.format` in app code (format types are stdlib's).

**Conformance.**
- `parse(encode(v))` round-trips for every type but `secret`.
- A schema has no `decode`.
- `s.string({ min: 1 })` fails `''`, `' '`, U+200B, U+3164 and a lone U+0301 with rule `required`; `decodeStrings` drops each if optional; the JSON Schema `pattern` refuses exactly the blank values without `M`, `Cs` or non-BMP characters.
- Generator produces only valid values.
- Parse rejects every invalid shape in the fixture set.
- Branded IDs are not assignable across brands.
- For every generated schema with marked nodes, `parse`, `encode`, `decodeStrings` and `gen` give what the unmarked schema gives.
- `piiPaths` lists each marked leaf once with its class, an array item as `*`, and every leaf under a marked object, then `*` for its undeclared keys when it is open; a control bound (k.forms) to a declared object under it carries its nearest mark's class as `data-k-pii`.
- For every generated value of a fixture schema, `piiValues` returns exactly the non-empty strings and the numbers under marked paths.
- For every generated valid value of an object schema of primitives, encoding to URLSearchParams then decodeStrings returns an equal value.
- For number and int with bounds, every generated value is within bounds and parse rejects values outside with rule min or max.
- Every generated json value round-trips and non-JSON values are rejected with rule type.
- Every generated value of a closed object round-trips, and adding an undeclared key fails with rule `unknown-key` at that key.
- Every generated value of a member union round-trips; a value no member accepts fails with the last member's issues.
- An open object with a `Secret` under an undeclared key, at any depth, fails with rule `type` at the `Secret`'s path.
- `Object.isFrozen` is true of `s`, of `s.object({ a: s.string().pii('name') })`, of its `node` and of each object under the node; `S.node.fields.b = s.secret(s.string()).node` and `delete S.node.fields.a` each throw a `TypeError` and leave `S.doc()` as it was.
