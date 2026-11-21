import type { Currency } from "@keel/std-money";

/** Reads `12.50`, `12,5` or `12` as minor units of `currency`; JPY takes no decimals. `null` when it is not that shape. */
export function minorUnits(text: string, currency: Currency): number | null {
  const decimals = currency === "JPY" ? 0 : 2;
  const m = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (m === null) return null;
  const whole = m[1] ?? "0";
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return Number(whole) * 10 ** decimals + Number(frac.padEnd(decimals, "0") || "0");
}
