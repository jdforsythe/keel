---
"@keel/check": patch
---

E1111 reports an `s.secret` node in a route's `params` or `search` as it reports a `.pii()` mark. The fix text carries the token after `#` in the link and has the page post it as an action input.
