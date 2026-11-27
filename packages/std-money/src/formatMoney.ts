/// <reference lib="es2023.intl" />
// es2023.intl types `Intl.NumberFormat#format` over a decimal string (`StringNumericLiteral`), which every runtime runs.
import type { Locale } from "@keel/std-i18n";
import type { Money } from "./Money.ts";
import { asDecimal } from "../unsafe/asDecimal.ts";
import { EXPONENT } from "./internal/EXPONENT.ts";


/** The exact decimal string of `amount` at exponent `e` (`-5`, 2 gives `-0.05`): string arithmetic, no float. */
function decimal(amount: number, e: number): string {
  const digits = Math.abs(amount)
    .toString()
    .padStart(e + 1, "0");
  const major = digits.slice(0, digits.length - e);
  const body = e > 0 ? `${major}.${digits.slice(digits.length - e)}` : major;
  return amount < 0 ? `-${body}` : body;
}

/**
 * `m` written for `locale` (std.money): `Intl.NumberFormat` in currency style over the exact decimal of `amount` at
 * the currency's exponent, so no amount passes through a float. `{ amount: 1250, currency: 'EUR' }` is `€12.50` in
 * `en-US` and `12,50 €` in `de-DE`. Reads no host locale.
 */
export function formatMoney(m: Money, locale: Locale): string {
  if (!Number.isSafeInteger(m.amount) || Math.abs(m.amount) > 1e15)
    throw new Error(`money amount ${m.amount} has no decimal form`);
  const d = asDecimal(decimal(m.amount, EXPONENT[m.currency]));
  if (d === undefined) throw new Error(`money amount ${m.amount} has no decimal form`);
  return new Intl.NumberFormat(locale, { style: "currency", currency: m.currency }).format(d);
}
