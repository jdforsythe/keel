---
"@keel/std-money": minor
"@keel/std-brands": minor
"@keel/std-geo": minor
"@keel/std-health": minor
"@keel/std-timings": minor
"@keel/std-report": minor
"@keel/compiler": minor
"@keel/check": minor
---

Stdlib wave 0 (RFC 0047): six stdlib packages, one per extension point: `@keel/std-money` (schema type registry), `@keel/std-brands` (check rule E2101 with fix), `@keel/std-geo` (capability `geo.position`), `@keel/std-health` (stdlib module manifest with a route), `@keel/std-timings` (inspect section `timings.recent`), `@keel/std-report` (formatter kind `report.tally`). k.module gains the optional `std` manifest key (`ModuleDef.std`, `ModuleSchema`), checked by the new E1158.
