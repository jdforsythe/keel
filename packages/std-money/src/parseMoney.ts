import { type Result, err, ok } from "@keel/schema";
import type { Locale } from "@keel/std-i18n";
import type { Currency } from "./Currency.schema.ts";
import { Money } from "./Money.schema.ts";
import type { ParseMoneyError } from "./ParseMoneyError.ts";
import { EXPONENT } from "./internal/EXPONENT.ts";
import { localeMarks } from "./internal/localeMarks.ts";
import { normalized } from "./internal/normalized.ts";

/** The longest text read, in characters of the raw text. */
const LONGEST = 64;

const unreadable = (): Result<never, ParseMoneyError> =>
  err({ code: "money.unreadable", message: "the text is not an amount in this locale", data: {} });

const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Typed text read as `Money` in `currency` for `locale` (std.money): an optional sign, an optional mark (the code or a
 * symbol), the number with the locale's separators, an optional mark; nothing is rounded and no message quotes the text.
 * `parseMoney('12,50 €', 'EUR', 'de-DE')` is `ok({ amount: 1250, currency: 'EUR' })`.
 */
export function parseMoney(text: string, currency: Currency, locale: Locale): Result<Money, ParseMoneyError> {
  if (text.length > 2 * LONGEST || [...text].length > LONGEST) return unreadable();
  const { decimal, group, marks } = localeMarks(locale, currency);
  let rest = normalized(text).trim();
  let negative = false;
  let signed = false;
  const sign = (): void => {
    const c = rest.charAt(0);
    if (signed || (c !== "-" && c !== "−")) return;
    signed = true;
    negative = true;
    rest = rest.slice(1);
  };
  const markAt = (from: "start" | "end"): { readonly currency: Currency; readonly length: number } | undefined => {
    for (const m of marks) {
      const part =
        from === "start" ? rest.slice(0, m.text.length) : rest.slice(Math.max(0, rest.length - m.text.length));
      if (part.length === m.text.length && part.toLowerCase() === m.text)
        return { currency: m.currency, length: m.text.length };
    }
    return undefined;
  };
  sign();
  const first = markAt("start");
  if (first !== undefined) {
    rest = rest.slice(first.length).replace(/^ +/, "");
    sign();
  }
  const last = first === undefined ? markAt("end") : undefined;
  if (last !== undefined) rest = rest.slice(0, rest.length - last.length).replace(/ +$/, "");
  const number = new RegExp(`^(\\d{1,3}(?:${escaped(group)}\\d{3})+|\\d+)(?:${escaped(decimal)}(\\d+))?$`).exec(rest);
  if (number === null) return unreadable();
  const mark = first ?? last;
  if (mark !== undefined && mark.currency !== currency) {
    const data = { left: currency, right: mark.currency };
    return err({
      code: "money.currencyMismatch",
      message: `the text is marked ${mark.currency}, not ${currency}`,
      data,
    });
  }
  const whole = (number[1] ?? "").split(group).join("");
  const fraction = number[2] ?? "";
  const decimals = EXPONENT[currency];
  if (fraction.length > decimals)
    return err({
      code: "money.tooManyDecimals",
      message: `${currency} takes at most ${decimals} decimals`,
      data: { currency, decimals },
    });
  const magnitude = Number(`${whole}${fraction.padEnd(decimals, "0")}`);
  const amount = negative && magnitude !== 0 ? -magnitude : magnitude;
  const money = Money.parse({ amount, currency });
  if (!money.ok)
    return err({ code: "money.overflow", message: "the amount is outside the amount bounds", data: { amount } });
  return ok(money.value);
}
