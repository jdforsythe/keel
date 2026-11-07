import type { Currency } from "./Currency.ts";
import type { Money } from "./Money.ts";

const EXPONENT: Readonly<Record<Currency, number>> = { EUR: 2, GBP: 2, JPY: 0, USD: 2 };

/**
 * `-12.34 USD` (std.money): optional sign, the absolute amount in major units with exactly the currency's exponent of
 * decimals (`.`, no grouping), a space, the code. Exact for every safe-integer amount: string arithmetic, no floats.
 */
export function formatMoney(m: Money): string {
  const e = EXPONENT[m.currency];
  const digits = Math.abs(m.amount)
    .toString()
    .padStart(e + 1, "0");
  const major = digits.slice(0, digits.length - e);
  const minor = digits.slice(digits.length - e);
  const sign = m.amount < 0 ? "-" : "";
  return `${sign}${major}${e > 0 ? `.${minor}` : ""} ${m.currency}`;
}
