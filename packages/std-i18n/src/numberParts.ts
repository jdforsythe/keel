import { decimalParts } from "../unsafe/decimalParts.ts";
import type { Locale } from "./Locale.schema.ts";

/**
 * `n` written for `locale` as `Intl.NumberFormat` parts (std.i18n): `formatToParts` in the default style, or in
 * currency style for `currency` (an ISO 4217 code) with `display` its `currencyDisplay`. A plain decimal string
 * (`-0.05`, `1800`) is formatted exactly, with no float. Joined, the parts' values are `format`'s text.
 */
export function numberParts(
  n: number | `${number}`,
  locale: Locale,
  currency?: string,
  display?: "symbol" | "narrowSymbol",
): Intl.NumberFormatPart[] {
  const nf =
    currency === undefined
      ? new Intl.NumberFormat(locale)
      : new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: display });
  return typeof n === "number" ? nf.formatToParts(n) : decimalParts(nf, n);
}
