# k.schema: Schemas
status: proposed

**Purpose.** One declaration per data shape. Everything derives from it.

**API.**
```ts
import { s } from '@keel/schema'
export const User = s.object({ id: s.id('User'), name: s.string({ min: 1 }), role: s.enum(['admin','member']), email: s.string().optional() })
type User = s.infer<typeof User>
```
Primitives: `string`, `number` (finite), `int`, `boolean`, `literal`, `enum`, `id(brand)`, `object`, `array`, `union` (discriminated), `record`. Modifiers: `optional()` (key may be absent) and `nullable()` (value may be null) are distinct. Registry: `s.register(name, type)` for stdlib types.

**Derivations.** `User.parse(x): Result<User, SchemaError>` · `User.encode/decode` JSON · `User.gen()` fast-check arbitrary · `User.doc()`.

**SchemaError** is the KeelError `schema.invalid` (k.errors): a plain value `{ code: 'schema.invalid', message, data: { issues: { path: (string | number)[], rule: Rule }[] } }`. `Rule` is closed: `type` · `finite` · `int` · `min` · `max` · `literal` · `enum` · `required` · `optional-null` (null given to an optional, non-nullable key) · `nullable-absent` (key absent for a nullable, non-optional key) · `discriminant`. Parse never throws; `encode` of an invalid value throws (unexpected). Re-registering a name with a different schema throws.

**Rules** (checker, on source; never runtime codes). E1101 string where enum expected · E1102 optional and nullable conflated · E1103 object field added after construction (compiler) · E1104 schema declared outside a `*.schema.ts` file.

**Conformance.** Round-trip for every type; generator produces only valid values; parse rejects every invalid shape in the fixture set; branded IDs are not assignable across brands.
