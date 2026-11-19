# std.temporal: Dates, instants and durations
status: conformance-covered

**Extension point.** Schema type registry (k.schema `s.register`). Importing `@keel/std-temporal` registers `temporal.Instant`, `temporal.PlainDate`, `temporal.TimeZone` and `temporal.Duration`, format types (k.formats) over `s.string()` with one canonical text per value, so `encode` is the identity.

**API** (`@keel/std-temporal`; client-safe, no config).
```ts
import { instantOf, plainDateOf, formatDate, UTC } from '@keel/std-temporal'
const at = instantOf(ctx.clock.now()) // ok('2026-11-10T09:30:00.000Z')
if (at.ok) addedOn = plainDateOf(at.value, UTC) // '2026-11-10'
formatDate(addedOn, props.params.locale, 'long') // de-DE: '10. November 2026'
```
- `Instant` is `YYYY-MM-DDTHH:mm:ss.sssZ`, a UTC instant to the millisecond in years 0001 to 9999, as `toISOString` writes it; string order is time order.
- `PlainDate` is `YYYY-MM-DD`, a proleptic Gregorian date in years 0001 to 9999; string order is date order.
- `TimeZone` is `UTC` or a Zone or Link name of the pinned IANA tz release, spelled as there, kept as written (`Asia/Kolkata`, `Asia/Calcutta`; not `utc`). `parse` and `gen` (its Zone names) read only that list. `UTC` is exported as a `TimeZone`. `plainDateOf` and `formatInstant` throw `RangeError` for a zone the host's `Intl` lacks.
- `Duration` is elapsed time in whole milliseconds, at most 1e15 either way: `PT0S`, or an optional `-`, `PT`, then `<h>H` if at least an hour, `<m>M` if the minutes (1 to 59) are nonzero, and `<s>S` or `<s>.<mmm>S` if the seconds or milliseconds are nonzero (`PT1H30M`, `-PT0.500S`).
- `DateStyle` is `s.enum(['short', 'medium', 'long', 'full'])`; `UnitStyle` is `s.enum(['long', 'short', 'narrow'])`.
- `TemporalError` is `KeelError<'temporal.outOfRange', { value: number }>`.
- `instantOf(ms: number): Result<Instant, TemporalError>` is the instant `Math.floor(ms)` milliseconds after the Unix epoch; a non-finite value, or one outside years 0001 to 9999, is `temporal.outOfRange` with `value` `ms`. No export reads the clock. `epochMs(i: Instant): number` is its inverse.
- `plainDateOf(i: Instant, zone: TimeZone): PlainDate` is the calendar date at `i` in `zone`; when that date leaves years 0001 to 9999, it is `i`'s UTC date.
- `addDays(d: PlainDate, days: number): Result<PlainDate, TemporalError>`: a non-integer `days`, or a result outside years 0001 to 9999, is `temporal.outOfRange` with `value` `days`.
- `durationOf(ms: number): Duration` for an integer within the bounds (any other `ms` throws); `durationMs(d: Duration): number` is its inverse.
- `formatDate(d: PlainDate, locale: Locale, style: DateStyle): string` is `new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' })` applied to `d` at 00:00 UTC.
- `formatInstant(i: Instant, locale: Locale, zone: TimeZone, style: DateStyle): string` is `new Intl.DateTimeFormat(locale, { dateStyle: style, timeStyle: style, timeZone: zone })` applied to `i`.
- `formatDuration(d: Duration, locale: Locale, style: UnitStyle): string` writes the nonzero hours, minutes and seconds of `d` (seconds with the millisecond fraction; `PT0S` as zero seconds), each as `new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: style })`, joined by `new Intl.ListFormat(locale, { type: 'unit', style })`; a negative `d` signs its first unit.

**Rules.** None. An ambient locale or time zone in app code is E1758 (k.check).

**Conformance.**
- After importing `@keel/std-temporal`, the registry maps the four names to the exports; importing it again does not throw.
- For every value `gen` produces for each of the four, `parse` accepts it, `encode` returns it unchanged and `doc()` is its name; generated dates reach 0001-01-01, 9999-12-31 and February 29.
- `Instant.parse` rejects `2026-11-10T09:30:00Z`, `2026-02-30T00:00:00.000Z` and `2026-11-10T09:30:00.000+01:00`; `PlainDate.parse` rejects `2023-02-29`, `2026-1-05` and `0000-01-01` and accepts `2024-02-29`; `TimeZone.parse` rejects `Mars/Olympus` and `utc`; `Duration.parse` rejects `PT90M`, `PT0.5S`, `P1D` and `-PT0S`. Each rejection has rule `format` at the value's path.
- For every generated in-range integer `ms`, `epochMs` of `instantOf(ms)`'s value is `ms` and `instantOf(ms + 0.5)` gives the same instant; `instantOf(253402300800000)` is `err` `temporal.outOfRange`.
- For every generated instant `i`, `plainDateOf(i, UTC)` is the first 10 characters of `i`; for `2026-11-10T23:30:00.000Z` it is `2026-11-11` in `Asia/Tokyo` and `2026-11-10` in `America/New_York`.
- For generated `d` and `n` whose results are in range, `addDays` of `addDays(d, n)`'s value and `-n` is `d`; `addDays('2024-02-28', 1)` is `2024-02-29`; `addDays('9999-12-31', 1)` is `err` with `value` 1.
- For every generated integer `ms` within the bounds, `durationMs(durationOf(ms))` is `ms`; `durationOf` of 0, 5400000 and -500 is `PT0S`, `PT1H30M` and `-PT0.500S`; `durationOf(0.5)` throws.
- For every `Locale`, style and generated value, `formatDate` and `formatInstant` equal the `Intl` expressions above. `formatDate('2026-11-10', l, 'long')` is `November 10, 2026`, `10. November 2026` and `2026年11月10日` for `en-US`, `de-DE` and `ja-JP`; `formatInstant('2026-11-10T23:30:00.000Z', 'de-DE', 'Asia/Tokyo', 'medium')` is `11.11.2026, 08:30:00`.
- `formatDuration` with `short` is `5 min`, `5 Min.` and `5 分` for `PT5M`, and `1 hr, 30 min`, `1 Std., 30 Min.` and `1 時間 30 分` for `PT1H30M`, in `en-US`, `de-DE` and `ja-JP`; in `en-US`, `-PT1H30M` is `-1 hr, 30 min`, `PT0S` is `0 sec` and `PT1.500S` is `1.5 sec`.
- With `process.env.TZ` set to `Pacific/Kiritimati` and then `America/Adak`, every export returns equal results for equal arguments.
- `TimeZone.parse` accepts `Asia/Kolkata`, `Asia/Calcutta` and `Europe/Kyiv` and rejects `asia/kolkata`; one seed gives equal `gen` values on every host.
- With `Intl.DateTimeFormat` refusing `Europe/Kyiv`, `TimeZone.parse` accepts it; `plainDateOf` and `formatInstant` throw `RangeError`.
