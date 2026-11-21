import type { Locale } from "./Locale.ts";

/** `n` written for `locale` (std.i18n): `new Intl.NumberFormat(locale).format(n)`; reads no host locale. */
export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(n);
}
