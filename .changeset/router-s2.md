---
"@keel/router": minor
---

k.prefix: an enum params field with `pathDefault` as a route's first segment is its prefix param. `routes.href` leaves out the default's segment, matching reads a path without it as the default and a path with it as its canonical form (the client lands on the URL without it), and `manifest` throws E1509 for a collision. A guard redirect carries the matched route's same-name params; a missing one is E1508. A path route's `title(props)` names the document: the client router sets `document.title` (the start title as fallback) and `document.documentElement.lang` after each navigation, writing nothing else. A format param reads as its base; routes.json JSON Schema adds `format: name`; rule `format` reads "Invalid value".
