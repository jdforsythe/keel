---
"@keel/router": minor
"@keel/server": patch
"@keel/check": minor
---

Guard redirects are bounded and `next` never nests (RFC 0051, E1508).
- **`@keel/router`.** A denied URL on a guard's redirect route passes its root-relative `next` on, instead of wrapping it. The client router reports E1508 (`keel.unexpected`) when a redirect revisits a location, or on the ninth redirect. This replaces the 8-hop "too many guard redirects".
- **`@keel/server`.** Before answering a guard's 302 or 303, the server evaluates the target's guards in-process. A loop, or a ninth hop, answers 500 E1508 with a dev `diag`.
- **`@keel/check`.** E1508 reports a guard whose literal `redirect` route has that guard in its chain.
