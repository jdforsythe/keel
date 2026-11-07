# @keel/forms

**Spec:** k.forms · **Status:** implemented · **verified:** (none)

## Contract

- **Public API:** `form(schema, { initial? })` -> `FormState<T>`: `field(path)`, `values()`, `errors()` (path -> message), `pending()` (a submission's one pending state; `<Form>` has no `loading`, RFC 0043), `reset()`; the `<Form form>` seam (`setPending(v)`, `validate()`, `onResult(r)`) is keyed by `formHandle` from `@keel/router/internal`, not public (RFC 0045). `Field<V>`: `name` (dotted path), `id`, `errorId`, `value()`, `error()`, `touched()`, `set(v)`, `blur()`, `bind(el)` -> unbind. `toFormData(schema, value)`. Types `FormState`, `Field`, `FieldPath`, `PathValue`, `DeepPartial`.
- **Invariants:** state lives in the calling scope (none: E1203); bindings unbind with their scope. A literal path outside `FieldPath<T>` is a type error; a path not in the schema throws `code: 'E1902'`. Messages derive from `schema.invalid` issues. Validate on blur, then on every input once an error has shown; `validate()` reports every issue (those no `field()` covers are also summarised under path `''`) and focuses the first invalid connected bound element in document order. Input text is coerced per the decodeStrings table; uncoercible text fails validation. `onResult`: `ok` resets to `initial`; `keel.fields` sets exactly its errors; other `err` changes nothing (the router `Form`'s `error` slot renders it). `decodeStrings(toFormData(s, v))` is `ok(v)` except `''` in optional/nullable keys, empty arrays or nested objects, record keys with `.`.
- **Dependencies:** `@keel/schema`, `@keel/reactive`, `@keel/router` (`FormHandle` seam).
- **Rungs:** conformance (example + probabilistic), properties (round-trip over generated schemas, path typing).

## Extension points

None.

## Unsafe

count: 1 (`unsafe/asSchemaValue.ts`: restores `Infer<S>` for values proven against the schema)
