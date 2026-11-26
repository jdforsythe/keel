import { attempt } from "@keel/schema";
import { refuse } from "../unsafe/refuse.ts";
import type { Locale } from "./Locale.schema.ts";
import { decimalParts } from "./internal/decimalParts.ts";

/** A plain decimal string: an optional `-`, digits with no leading zero, and a point only between digits. */
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

/**
 * `n` written for `locale` as `Intl.NumberFormat` parts (std.i18n): `formatToParts` in the default style, or in
 * currency style for `currency` (an ISO 4217 code) with `display` its `currencyDisplay`. A plain decimal string
 * (`-0.05`, `1800`) is formatted exactly, with no float; any other string, and a currency `Intl` refuses, throws a
 * `RangeError` (`numberParts: ...`), as does a decimal string on a runtime whose `Intl.NumberFormat` predates
 * ECMA-402 2023 and would read it through a float. Joined, the parts' values are `format`'s text.
 */
export function numberParts(
  n: number | `${number}`,
  locale: Locale,
  currency?: string,
  display?: "symbol" | "narrowSymbol",
): Intl.NumberFormatPart[] {
  if (typeof n === "string" && !DECIMAL.test(n))
    refuse("numberParts", `${JSON.stringify(n.slice(0, 40))} is no plain decimal`);
  const r = attempt((): Intl.NumberFormatPart[] | undefined => {
    const nf =
      currency === undefined
        ? new Intl.NumberFormat(locale)
        : new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: display });
    return typeof n === "number" ? nf.formatToParts(n) : decimalParts(nf, n);
  });
  if (!r.ok) return refuse("numberParts", r.error.data.cause);
  return r.value ?? refuse("numberParts", "this runtime's Intl.NumberFormat formats no decimal string exactly");
}
