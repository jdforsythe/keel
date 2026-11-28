---
"@keel/server": patch
"@keel/forms": patch
---

A rejected form post never echoes a secret: the 422 `#k-state` `form.values` drops every key whose action input schema reaches `s.secret` (any nesting) and every key the re-rendered page names on a `type="password"` input; a re-render that shows an errorElement instead of the route's component, or throws, carries no `form`. The schema walk follows object fields by name and treats every key under an array, record or union that holds a secret as secret (record keys holding dots included), in time linear in the key length; a schema with no secret drops nothing. Other fields keep their values and every field error still shows. A field whose schema is `s.secret` writes no markup default on any bound control.
