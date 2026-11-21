---
"@keel/router": patch
---

The JSON Schema of a `string` with `min` >= 1 in the routes artifact carries a `pattern` of `\u` ranges that ECMA-262, with or without the `u` flag, and Python `re` read alike, refusing the blank set's characters below U+10000 but combining marks and surrogates.
