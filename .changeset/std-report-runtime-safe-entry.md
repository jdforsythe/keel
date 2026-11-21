---
"@keel/std-report": minor
"@keel/cli": minor
"@keel/check": patch
---

`@keel/std-report` is data only (`Tally`, `tallyOf`; it imports `@keel/schema` alone), so server and browser code of a deployable import it and `keel build` passes. `@keel/std-report/tools` registers the `report.tally` formatter and the `report` command. `stdCommand` reserves `report` beside `session`, and `keel report [url]` prints each tally a dev app serves as an inspector section, then `ok report <n> tallies`; E1056 for a bad target, I1055 without the package in `deps`. An unfilled `keel session` says it needs `the stdlib session module`. Migration: code that emits or renders a `report.tally` record adds `import '@keel/std-report/tools'`.
