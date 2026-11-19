---
"@keel/schema": minor
---

A `string` with `min` >= 1 refuses a blank value with rule `required`: one with no character outside `White_Space`, `Default_Ignorable_Code_Point`, the general categories `Cc`, `Cf`, `Cs` and `M`, and U+2800, so a zero-width space, a Hangul filler or a lone combining mark is refused as `' '` is. `decodeStrings` drops such a value for an optional key, and `gen` never yields one. `@keel/schema/internal` exports `blankPattern`, the JSON Schema `pattern` of such a string.
