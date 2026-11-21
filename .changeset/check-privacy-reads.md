---
"@keel/check": minor
"@keel/std-jobs": minor
"@keel/std-tokens": minor
---

`@keel/check` exports the privacy readers its rules run: `carriesReveal`, `schemaHolds` and `outputSchemas` (k.privacy-reads). `keel check` warns W1114 for a password control bound to a field that is not `s.secret`. `@keel/std-jobs/tools` reports E2506 for a revealed value given to `enqueue`, and `@keel/std-tokens/tools` E2203 for `Digested` in a loader or API `output`.
