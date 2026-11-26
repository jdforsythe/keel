import { attempt } from "@keel/schema";
import { decimalParts } from "../unsafe/decimalParts.ts";
import { refuse } from "../unsafe/refuse.ts";
import type { Locale } from "./Locale.schema.ts";

/** A plain decimal string: an optional `-`, digits with no leading zero, and a point only between digits. */
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

/**
 * `n` written for `locale` as `Intl.NumberFormat` parts (std.i18n): `formatToParts` in the default style, or in
 * currency style for `currency` (an ISO 4217 code) with `display` its `currencyDisplay`. A plain decimal string
 * (`-0.05`, `1800`) is formatted exactly, with no float; any other string, and a currency `Intl` refuses, throws a
 * `RangeError` (`numberParts: ...`). Joined, the parts' values are `format`'s text.
 */
export function numberParts(
  n: number | `${number}`,
  locale: Locale,
  currency?: string,
  display?: "symbol" | "narrowSymbol",
): Intl.NumberFormatPart[] {
  if (typeof n === "string" && !DECIMAL.test(n))
    refuse("numberParts", `${JSON.stringify(n.slice(0, 40))} is no plain decimal`);
  const r = attempt((): Intl.NumberFormatPart[] => {
    const nf =
      currency === undefined
        ? new Intl.NumberFormat(locale)
        : new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: display });
    return typeof n === "number" ? nf.formatToParts(n) : decimalParts(nf, n);
  });
  return r.ok ? r.value : refuse("numberParts", r.error.data.cause);
}
