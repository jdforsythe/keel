import type { Locale } from "./Locale.schema.ts";

/**
 * The time `t` (milliseconds since the epoch) written for `locale` (std.i18n): `Intl.DateTimeFormat` with `options`,
 * whose `timeZone` is required, so neither the host locale nor the host time zone is read.
 */
export function formatDateTime(
  t: number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions & { readonly timeZone: string },
): string {
  return new Intl.DateTimeFormat(locale, options).format(t);
}
