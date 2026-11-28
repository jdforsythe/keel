import { defect } from "@keel/schema";
import type { Locale } from "./Locale.schema.ts";
import { decimalParts } from "./internal/decimalParts.ts";
import { refusing } from "./internal/refusing.ts";

/** A plain decimal string: an optional `-`, digits with no leading zero, and a point only between digits. */
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

/**
 * `n` written for `locale` as `Intl.NumberFormat` parts (std.i18n): `formatToParts` in the default style, or in
 * currency style for `currency` (an ISO 4217 code) with `display` its `currencyDisplay`. A plain decimal string
 * (`-0.05`, `1800`) is formatted exactly, with no float; any other string, and a currency `Intl` refuses, raises a
 * defect (`numberParts: ...`), as does a decimal string on a runtime whose `Intl.NumberFormat` predates
 * ECMA-402 2023 and would read it through a float. Joined, the parts' values are `format`'s text.
 */
export function numberParts(
  n: number | `${number}`,
  locale: Locale,
  currency?: string,
  display?: "symbol" | "narrowSymbol",
): Intl.NumberFormatPart[] {
  if (typeof n === "string" && !DECIMAL.test(n))
    defect("numberParts: the string is no plain decimal", { data: { n: n.slice(0, 40) } });
  const r = refusing((): Intl.NumberFormatPart[] | undefined => {
    const nf =
      currency === undefined
        ? new Intl.NumberFormat(locale)
        : new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: display });
    return typeof n === "number" ? nf.formatToParts(n) : decimalParts(nf, n);
  });
  if (!r.ok) return defect("numberParts: Intl refuses the currency or the number", { cause: r.error });
  return r.value ?? defect("numberParts: this runtime's Intl.NumberFormat formats no decimal string exactly");
}
