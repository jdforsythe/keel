import { type Locale, formatDateTime } from "@keel/std-i18n";
import type { DateStyle } from "./DateStyle.schema.ts";
import type { Instant } from "./Instant.schema.ts";
import type { TimeZone } from "./TimeZone.schema.ts";

/** `i` written for `locale` as the wall time in `zone` (std.temporal): `formatDateTime` of `@keel/std-i18n` with `dateStyle` and `timeStyle` `style`. */
export function formatInstant(i: Instant, locale: Locale, zone: TimeZone, style: DateStyle): string {
  return formatDateTime(Date.parse(i), locale, { dateStyle: style, timeStyle: style, timeZone: zone });
}
