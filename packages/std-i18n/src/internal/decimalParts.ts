import { decimalFormat } from "../../unsafe/decimalFormat.ts";

/**
 * `nf.formatToParts(d)` over the plain decimal literal `d` (`-0.05`, `1800`), formatted exactly (std.i18n), or
 * `undefined` on a runtime whose `Intl.NumberFormat` would read `d` through a float.
 */
export function decimalParts(nf: Intl.NumberFormat, d: `${number}`): Intl.NumberFormatPart[] | undefined {
  return decimalFormat(nf)?.formatToParts(d);
}
