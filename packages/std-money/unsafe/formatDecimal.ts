import { unsafe } from "./unsafe.ts";

/** `nf.format(d)` over the plain decimal literal `d` (`-0.05`, `1800`), which `Intl.NumberFormat` formats exactly (std.money). */
export function formatDecimal(nf: Intl.NumberFormat, d: `${number}`): string {
  return unsafe(
    "Intl.NumberFormat formats a decimal string literal exactly in every runtime Keel supports (ECMA-402 2023), while the ES2022 lib Keel type-checks against types format over number and bigint only, so the string passes as its declared parameter type",
    () => nf.format(d as unknown as number),
  );
}
