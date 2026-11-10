import type { Locale } from "@keel/std-i18n";
import type { DateStyle } from "./DateStyle.ts";
import type { PlainDate } from "./PlainDate.ts";

/** `d` written for `locale` (std.temporal): `Intl.DateTimeFormat` with `dateStyle: style` in UTC, applied at 00:00 UTC. */
export function formatDate(d: PlainDate, locale: Locale, style: DateStyle): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: "UTC" }).format(Date.parse(d));
}
