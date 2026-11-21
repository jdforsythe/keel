---
"@keel/schema": minor
"@keel/store": patch
"@keel/std-channels": patch
"@keel/std-jobs": patch
"@keel/std-offline": patch
"@keel/std-sessions": patch
---

`@keel/schema` exports `secretPath(schema)`, the dotted object-key path of the first `s.secret` node (`""` at the root, null when none), and `sampleFormat(node, sample)`, an encoded value of a format type without fast-check (k.parity). `@keel/store`, `@keel/std-channels`, `@keel/std-jobs`, `@keel/std-offline` and `@keel/std-sessions` call them in place of `@keel/schema/internal`; std-sessions writes an unapplied replay input's E2003 into its own recorder.
