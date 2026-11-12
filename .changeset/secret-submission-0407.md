---
"@keel/server": patch
"@keel/forms": patch
---

A rejected form post never echoes a secret: the 422 `#k-state` `form.values` drops every key whose action input schema reaches `s.secret` (any nesting) and every key the re-rendered page names on a `type="password"` input; a render that throws carries no `form`. Other fields keep their values and every field error still shows. A field whose schema is `s.secret` writes no markup default on any bound control.
