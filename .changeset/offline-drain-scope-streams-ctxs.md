---
"@keel/std-offline": patch
---

`@keel/std-offline`: ending `drain`'s scope drops the retry pending on its ctx; `outbox` throws E2652 for an `events: true` endpoint; one outbox used from several ctxs keeps each ctx's entries apart (owner change, flush, retry, `resolve` and storage writes).
