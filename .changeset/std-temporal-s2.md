---
"@keel/std-temporal": minor
---

`@keel/std-temporal`: instants, calendar dates, time zones and durations as canonical ISO strings, shown for a locale. Importing the package registers the format types `temporal.Instant`, `temporal.PlainDate`, `temporal.TimeZone` and `temporal.Duration`. It exports `UTC`, `DateStyle`, `UnitStyle`, `instantOf`, `epochMs`, `plainDateOf`, `addDays`, `durationOf`, `durationMs`, `formatDate`, `formatInstant`, `formatDuration` and the type `TemporalError` (`temporal.outOfRange`). No export reads the clock, the host locale or the host time zone.
