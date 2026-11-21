---
"@keel/server": minor
---

A thrown loader's, action's or runner's json `diag` carries `frames`: the first 5 stack positions in app code (outside `packages/`, `node_modules/`, `.keel/` and the working directory), each `<path>:<line>:<col>` relative to the working directory, scrubbed of the request's `.pii()` values like the message. The `keel.unexpected` error the loader or action answers is unchanged and holds no stack. Compact lines are unchanged.
