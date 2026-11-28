---
"@keel/schema": patch
---

`@keel/schema/internal` exports `onSecret(listener)`, one listener slot that `Secret.of` calls with each new `Secret`, so `@keel/server` can mark every secret a request makes in its log; nothing changes for app code.
