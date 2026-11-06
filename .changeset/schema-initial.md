---
"@keel/schema": minor
---

k.schema: `s` namespace (string, number, int, boolean, literal, enum, id, object, array, union, record; `.optional()` and `.nullable()`), `parse`/`decode` to `Result<T, SchemaError>` (KeelError `schema.invalid` with issues), `encode` to JSON, `gen()` fast-check arbitrary, `doc()`, `s.register`/`s.registry`. k.errors: `Result`, `ok`, `err`, `KeelError`, `s.error(code, data).make`, `s.result(T, E)`, `attempt(fn)`.
