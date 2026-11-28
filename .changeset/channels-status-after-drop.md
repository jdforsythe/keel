---
"@keel/std-channels": patch
"@keel/std-live": patch
---

`subscribe`'s `status()` is `connecting` from the moment a stream ends until the reopened stream's `reset`, so `live`'s status leaves `live` while the stream waits to reopen; the reopen's `reset` re-reads what was written meanwhile.
