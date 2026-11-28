---
"@keel/cli": minor
"@keel/std-jobs": patch
"@keel/std-channels": patch
"@keel/std-live": patch
"@keel/std-offline": patch
---

The stdlib's supervisors run code they do not own under `supervise` (k.supervise): a job's `fn` (`jobs.run`), a channel route's `member` and `currentUser()` (`channels.member`), its storage reads and watch (`channels.storage`) and follows (`channels.follow`), a live view's `read` (`live.read`) and each outbox `ctx.storage` call (`offline.storage`). A throw of any value, a defect or a string among them, is reported once and takes the failure path: a job retries and ends `jobs.thrown`, a channel denies, a live read stays `connecting` and retries on the backoff, an outbox entry is `failed` with `offline.storage`. `keel review` lists R1017's wider forms (k.expect Decides), each `supervise` call (R1018), a `Symbol.for` whose key does not fold to a string (R1019) and a global or `process` listener whose event name is no literal (R1020).
