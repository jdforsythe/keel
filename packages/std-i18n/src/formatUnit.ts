import { defect } from "@keel/schema";
import type { Locale } from "./Locale.schema.ts";
import { refusing } from "./internal/refusing.ts";

/**
 * `n` written for `locale` as `unit` (std.i18n): `Intl.NumberFormat` with `style: 'unit'` and `unitDisplay: display`;
 * a unit `Intl` refuses raises a defect (`formatUnit: ...`) whose `cause` names the class `Intl` threw.
 */
export function formatUnit(n: number, locale: Locale, unit: string, display: "long" | "short" | "narrow"): string {
  const r = refusing(() => new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: display }).format(n));
  return r.ok ? r.value : defect("formatUnit: Intl refuses the unit or the number", { cause: r.error });
}
