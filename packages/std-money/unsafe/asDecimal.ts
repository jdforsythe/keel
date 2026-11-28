import { unsafe } from "./unsafe.ts";

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** `s` as the decimal literal type `Intl.NumberFormat` formats exactly (`-0.05`, `1800`), or `undefined`. */
export function asDecimal(s: string): `${number}` | undefined {
  if (!DECIMAL.test(s)) return undefined;
  return unsafe(
    "a string the pattern -?digits(.digits)? matches is a decimal literal, which no check but the pattern proves",
    () => s as `${number}`,
  );
}
