---
"@keel/schema": patch
"@keel/forms": patch
"@keel/services": patch
---

In `decodeStrings` and in a form, a value with no non-whitespace character for an optional `string` with `min` >= 1 is absent, as `''` is. A 502 `keel.unreachable` err is `api.network` only for a `service({ module })` call, read from at most 1 KiB of the body; a `service({ base })` call keeps its declared 502 error or `api.status`.
