---
"@keel/cli": patch
---

The JSON Schema of a `string` with `min` >= 1 (MCP tool schemas) carries a `pattern` of `\u` ranges that ECMA-262, with or without the `u` flag, and Python `re` read alike, refusing the blank set's characters below U+10000 but combining marks and surrogates. `pii.json` gains a `<object>.*` row for each marked open object.
