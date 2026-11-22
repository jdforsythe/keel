---
"@keel/router": minor
"@keel/check": patch
"@keel/cli": patch
---

`manifest`, and `routeTable` for a chain it joins across modules, throw E1508 when a guarded page lacks a field of its redirect route's `params` or carries one whose schema does not fit the target's (an `id` of another brand, an `enum` with a value the target refuses, wider `min` or `max` bounds), so `keel build` reports it before any denial. `keel explain E1508` names the case.
