---
"@keel/router": patch
---

`navigate` from a callback outside any router scope reaches a router only when exactly one is mounted; with several it does nothing, so a second router or a stale harness is never navigated by mistake.
