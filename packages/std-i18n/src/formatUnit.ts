import type { Locale } from "./Locale.schema.ts";

/** `n` written for `locale` as `unit` (std.i18n): `Intl.NumberFormat` with `style: 'unit'` and `unitDisplay: display`. */
export function formatUnit(n: number, locale: Locale, unit: string, display: "long" | "short" | "narrow"): string {
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: display }).format(n);
}
