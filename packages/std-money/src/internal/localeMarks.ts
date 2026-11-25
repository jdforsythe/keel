import type { Locale } from "@keel/std-i18n";
import type { Currency } from "../Currency.schema.ts";
import type { CurrencyMarks } from "./CurrencyMarks.ts";
import { normalized } from "./normalized.ts";

const CURRENCIES: readonly Currency[] = ["EUR", "GBP", "JPY", "USD"];
const cache = new Map<string, CurrencyMarks>();

/** The separators and currency marks of `locale` as the text is normalized (memoized: `Intl` construction is slow). */
export function localeMarks(locale: Locale, target: Currency): CurrencyMarks {
  const key = `${locale} ${target}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const part = (type: string): string => normalized(parts.find((p) => p.type === type)?.value ?? "");
  const marks: { text: string; currency: Currency }[] = [];
  for (const currency of CURRENCIES) {
    const texts = new Set<string>([currency]);
    for (const currencyDisplay of ["symbol", "narrowSymbol"] as const) {
      const c = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay })
        .formatToParts(1)
        .find((p) => p.type === "currency");
      if (c !== undefined) texts.add(c.value);
    }
    for (const t of texts) marks.push({ text: normalized(t).toLowerCase(), currency });
  }
  marks.sort((a, b) => b.text.length - a.text.length || Number(b.currency === target) - Number(a.currency === target));
  const made: CurrencyMarks = { decimal: part("decimal"), group: part("group"), marks };
  cache.set(key, made);
  return made;
}
