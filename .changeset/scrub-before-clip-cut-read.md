---
"@keel/server": patch
"@keel/schema": patch
---

A runner's rejection is scrubbed whole before it is clipped, so a secret the 89-character clip would cut in two is one mark; the server-bug response in dev and the E1508 diag are scrubbed whole too. A `Secret` too large to read whole (more than 1,000,000 values) puts its scope past the scrub's cap, so every thrown text of the scope is one mark. `@keel/schema/internal` exports `secretWalk`, the read with whether it was cut.
