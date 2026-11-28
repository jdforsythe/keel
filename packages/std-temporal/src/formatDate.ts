import { type Locale, formatDateTime } from "@keel/std-i18n";
import type { DateStyle } from "./DateStyle.schema.ts";
import type { PlainDate } from "./PlainDate.schema.ts";

/** `d` written for `locale` (std.temporal): `formatDateTime` of `@keel/std-i18n` with `dateStyle: style` in UTC, applied at 00:00 UTC. */
export function formatDate(d: PlainDate, locale: Locale, style: DateStyle): string {
  return formatDateTime(Date.parse(d), locale, { dateStyle: style, timeZone: "UTC" });
}
