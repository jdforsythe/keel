---
"@keel/server": patch
---

The log scrub also marks a secret JSON-escaped with `\u` for each non-ASCII unit, JSON-escaped twice, URL-encoded twice, encoded by `encodeURI` and form-encoded (`+` for a space).
