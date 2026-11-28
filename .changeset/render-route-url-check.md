---
"@keel/testing": patch
---

`renderRoute(id, { url })` takes only a root-relative path and query that matches page `id` (another route, origin or scheme is E1501), and every route harness starts and ends with scroll at the top, so `location().scrollY` never reports the previous test's position.
