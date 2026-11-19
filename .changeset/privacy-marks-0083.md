---
"@keel/schema": minor
"@keel/forms": minor
"@keel/runtime-dom": patch
---

Personal data marks (k.privacy): `.pii(class)` on any schema node with the closed `PiiClass`; `piiPaths(schema)` and `piiValues(schema, value)`; `doc()` appends ` pii(<class>)`. A form control bound to a marked path carries `data-k-pii`, and the ctx observer reports its input masked as it does a password field.
