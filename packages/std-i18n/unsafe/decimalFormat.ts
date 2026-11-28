import type { DecimalFormat } from "../src/internal/DecimalFormat.ts";
import { unsafe } from "./unsafe.ts";

/**
 * `nf` as ECMA-402 2023's `Intl.NumberFormat`, whose `formatToParts` takes a decimal string, when it has `formatRange`
 * (the two came in the same edition), else `undefined`.
 */
export function decimalFormat(nf: Intl.NumberFormat): (Intl.NumberFormat & DecimalFormat) | undefined {
  if (typeof Reflect.get(nf, "formatRange") !== "function") return undefined;
  return unsafe(
    "a runtime's Intl.NumberFormat with formatRange is ECMA-402 2023's, whose formatToParts formats a decimal string exactly; the edition is read from the object at run time and the TypeScript lib in use types no such call",
    () => nf as Intl.NumberFormat & DecimalFormat,
  );
}
