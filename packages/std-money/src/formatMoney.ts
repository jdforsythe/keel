import { type Locale, numberParts } from "@keel/std-i18n";
import { defect } from "@keel/schema";
import { asDecimal } from "../unsafe/asDecimal.ts";
import type { Money } from "./Money.schema.ts";
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
 * `m` written for `locale` (std.money): `numberParts` of `@keel/std-i18n` in currency style over the exact decimal of
 * `amount` at the currency's exponent, joined, so no amount passes through a float. `{ amount: 1250, currency: 'EUR' }` is `€12.50` in
 * `en-US` and `12,50 €` in `de-DE`. Reads no host locale.
 */
export function formatMoney(m: Money, locale: Locale): string {
  const d = Number.isSafeInteger(m.amount) && Math.abs(m.amount) <= 1e15 ? asDecimal(decimal(m.amount, EXPONENT[m.currency])) : undefined;
  if (d === undefined) return defect("money amount has no decimal form", { data: { amount: String(m.amount) } });
  return numberParts(d, locale, m.currency)
    .map((p) => p.value)
    .join("");
}
