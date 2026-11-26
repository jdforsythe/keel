import type { DecimalFormat } from "./DecimalFormat.ts";

/**
 * Whether `nf` is ECMA-402 2023's `Intl.NumberFormat`: `formatRange` and exact formatting of a decimal string came in
 * the same edition, so its `formatRange` shows that `formatToParts` reads a string as a decimal, not through a float.
 */
function isDecimalFormat(nf: Intl.NumberFormat): nf is Intl.NumberFormat & DecimalFormat {
  return "formatRange" in nf && typeof nf.formatRange === "function";
}

/**
 * `nf.formatToParts(d)` over the plain decimal literal `d` (`-0.05`, `1800`), formatted exactly (std.i18n), or
 * `undefined` on a runtime whose `Intl.NumberFormat` would read `d` through a float.
 */
export function decimalParts(nf: Intl.NumberFormat, d: `${number}`): Intl.NumberFormatPart[] | undefined {
  return isDecimalFormat(nf) ? nf.formatToParts(d) : undefined;
}
