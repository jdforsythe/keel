---
"@keel/server": patch
"@keel/schema": patch
---

The server log scrub no longer throws on a secret or pii value with a lone surrogate, so the request's `diag` is still written; a `Secret` holding an object or an array marks each string and number in it; overlapping secret and pii values are replaced as one run, so no part of a secret is left; the scrub's matchers are built once per request set and batched so no value makes an expression the engine refuses; and each `createApp` puts the server's `onSecret` listener back.
