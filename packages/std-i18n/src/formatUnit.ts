import type { Locale } from "./Locale.schema.ts";
import { refusing } from "./internal/refusing.ts";

/**
 * `n` written for `locale` as `unit` (std.i18n): `Intl.NumberFormat` with `style: 'unit'` and `unitDisplay: display`;
 * a unit `Intl` refuses throws a `RangeError` (`formatUnit: ...`).
 */
export function formatUnit(n: number, locale: Locale, unit: string, display: "long" | "short" | "narrow"): string {
  return refusing("formatUnit", () =>
    new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: display }).format(n),
  );
}
