---
"@keel/std-temporal": minor
---

`@keel/std-temporal` is a library (k.library): a module that imports it lists `@keel/std-temporal` in `deps`. Its six schemas live in `*.schema.ts` files, and the `./tools` entry registers `temporal.Duration`, `temporal.Instant`, `temporal.PlainDate` and `temporal.TimeZone`, so `keel check` and `keel build` see the formats. `durationOf`'s throw sits in `unsafe/` with its reason. Its own folder's `keel check` sees the formats too, so `UTC` is `formatLiteral(TimeZone, "UTC")`. Its own folder's `keel check` sees the formats too, so `UTC` is `formatLiteral(TimeZone, "UTC")`.
