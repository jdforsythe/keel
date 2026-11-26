import { type Locale, formatList, formatUnit } from "@keel/std-i18n";
import type { Duration } from "./Duration.schema.ts";
import type { UnitStyle } from "./UnitStyle.schema.ts";
import { durationValue } from "./internal/durationValue.ts";

/**
 * `d` written for `locale` (std.temporal): its nonzero hours, minutes and seconds (with the millisecond fraction; `PT0S`
 * as zero seconds), each a `formatUnit`, joined by `formatList` type `unit` (both of `@keel/std-i18n`). A negative `d` signs its
 * first unit. `Intl.DurationFormat` is not used: Node 22 lacks it.
 */
export function formatDuration(d: Duration, locale: Locale, style: UnitStyle): string {
  const ms = durationValue(d);
  const a = Math.abs(ms);
  const units: [number, string][] = [
    [Math.floor(a / 36e5), "hour"],
    [Math.floor(a / 6e4) % 60, "minute"],
    [(a % 6e4) / 1e3, "second"],
  ];
  const shown = units.filter(([n], k) => n || (k === 2 && !a));
  const text = shown.map(([n, unit], k) => formatUnit(k || ms >= 0 ? n : -n, locale, unit, style));
  return formatList(text, locale, "unit", style);
}
