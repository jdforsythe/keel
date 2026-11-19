---
"@keel/check": minor
---

k.compat pass over `.keel/surface.json`: `accepts` on JSON Schema nodes; E1561 for a `service({ module })` endpoint its route refuses (request, `output` or `errors` against the route's answer), at the endpoint, no fix; E1562 with `check(files, { base })` for a route change a base endpoint in another deployable refuses, at the route's schema field, with an `.optional()` fix for one added required field. `surface.json` is E1005 when tampered or when a source it records changed. E1152 and E1157 also read `service({ module })` calls.
