---
"@keel/testing": patch
---

The synchronous axe-core rule run reads axe's internals through a type guard over each member it uses; `@keel/testing` holds one `unsafe` call.
