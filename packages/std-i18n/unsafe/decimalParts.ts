import { unsafe } from "./unsafe.ts";

/** `nf.formatToParts(d)` over the plain decimal literal `d` (`-0.05`, `1800`), which `Intl.NumberFormat` formats exactly (std.i18n). */
export function decimalParts(nf: Intl.NumberFormat, d: `${number}`): Intl.NumberFormatPart[] {
  return unsafe(
    "Intl.NumberFormat formats a decimal string literal exactly in every runtime Keel supports (ECMA-402 2023), while the ES2022 lib Keel type-checks against types formatToParts over number and bigint only, so the string passes as its declared parameter type",
    () => nf.formatToParts(d as unknown as number),
  );
}
