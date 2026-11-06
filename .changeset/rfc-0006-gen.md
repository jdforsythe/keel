---
"@keel/schema": minor
---

k.schema (rfc:0006): generators move to `import { gen } from '@keel/schema/gen'`; `Schema.gen()` is removed. `fast-check` is now a peer dependency imported only by the `./gen` subpath, so app bundles no longer ship it.
