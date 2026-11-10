# @keel/std-temporal

**Spec:** std.temporal · **Status:** proposed · **verified:** (none)

## Contract

- **Public API:** format types `Instant` (`2026-11-10T09:30:00.000Z`, UTC to the millisecond), `PlainDate` (`2026-11-10`), `TimeZone` (`UTC` or an IANA name) and `Duration` (`PT1H30M`, `-PT0.500S`, whole milliseconds within 1e15), each in years 0001 to 9999 where it has a date; `UTC`; `DateStyle` (`short | medium | long | full`), `UnitStyle` (`long | short | narrow`); `instantOf(ms): Result<Instant, TemporalError>`, `epochMs(i)`, `plainDateOf(i, zone)`, `addDays(d, days): Result<PlainDate, TemporalError>`, `durationOf(ms)`, `durationMs(d)`; `formatDate(d, locale, style)`, `formatInstant(i, locale, zone, style)`, `formatDuration(d, locale, style)`; type `TemporalError` (`temporal.outOfRange`).
- **Invariants:** importing the package registers `temporal.Instant`, `temporal.PlainDate`, `temporal.TimeZone` and `temporal.Duration` (idempotent). Each value has one canonical ISO 8601 text, so `encode` is the identity, equal values are equal strings and string order is time order for instants and dates. No export reads the clock (the current instant is `instantOf(ctx.clock.now())`), the host locale or the host time zone: calendar math uses `Date` UTC methods, formatting uses `Intl` with the given `Locale`. `formatDuration` is built from `Intl.NumberFormat` units and `Intl.ListFormat`. `plainDateOf` gives `i`'s UTC date when the date in `zone` would leave years 0001 to 9999 (about 15 hours from the bounds).
- **Dependencies:** `@keel/schema` (`s.format`), `@keel/std-i18n` (`Locale`).
- **Rungs:** conformance (example + probabilistic), properties for `addDays` additivity, instant order, and `formatDate` and `formatDuration` injectivity per locale.

## Extension points

Uses the **schema type registry** (k.schema `s.register`). It registers four format types (k.schema `s.format`) over `s.string()`; parse, encode, generator and doc derive from them.

## Unsafe

count: 0
