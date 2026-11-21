import type { Locale } from "@keel/std-i18n";
import type { DateStyle } from "./DateStyle.ts";
import type { Instant } from "./Instant.ts";
import type { TimeZone } from "./TimeZone.ts";

/** `i` written for `locale` as the wall time in `zone` (std.temporal): `Intl.DateTimeFormat` with `dateStyle` and `timeStyle` `style`. */
export function formatInstant(i: Instant, locale: Locale, zone: TimeZone, style: DateStyle): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: style, timeStyle: style, timeZone: zone }).format(Date.parse(i));
}
