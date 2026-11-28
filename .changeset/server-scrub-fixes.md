---
"@keel/server": patch
"@keel/schema": patch
---

The server log scrub no longer throws on a secret or pii value with a lone surrogate, so the request's `diag` is still written; a `Secret` holding an object or an array marks each string and number in it; overlapping secret and pii values are replaced as one run, so the whole of each marked copy is replaced; the scrub's matchers are built once per request set and batched so no value makes an expression the engine refuses; and each `createApp` puts the server's `onSecret` listener back.
A value over 1,000 characters is found by a linear scan and base64 copies match with or without padding in both alphabets.
