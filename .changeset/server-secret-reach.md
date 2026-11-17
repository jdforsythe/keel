---
"@keel/server": patch
---

Each request runs in its own set of revealed secrets, carried along its promise chain: every `Secret` made while the request runs (its action input, `bearer`, a loader's or action's parse after an `await`, a minted token) is `[secret]` in that request's `diag` records, including a live stream's later records. Overlapping requests and an in-process peer's request mark only their own records; runners start outside any request's set.
