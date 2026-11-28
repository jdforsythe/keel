---
"@keel/std-geo": minor
---

`@keel/std-geo` carries a library manifest (`module.ts`, id `geo`) and its `@keel/*` imports as peers. `Position` lives in `src/Position.schema.ts`. Real `geo` reads `getCurrentPosition` through `attempt`, so a throw there gives `geo.unavailable` with the message `geolocation threw: <cause>`, `<cause>` as `attempt` describes it (`Error: boom`).
