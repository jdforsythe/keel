---
"@keel/std-live": minor
---

`live` calls `read(ctx, signal)`: the `AbortSignal` aborts when the read's 30 s pass while it is pending and when the scope is disposed while it is pending, so a given-up read can cancel its request. A `read` that takes only `ctx` still type-checks.
