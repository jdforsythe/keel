---
"@keel/server": patch
---

Every thrown text the server sends on goes through the request's scrub first: an `output` encode that throws in a loader's result or a live loader's stream line, a component or errorElement that throws while rendering (the errorElement's `error`, the default alert, the dev message), and a failed guard redirect's message hold `[secret]` and `[pii]` in place of the request's values.
