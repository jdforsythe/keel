import type { Locale } from "@keel/std-i18n";

const collators = new Map<Locale, Intl.Collator>();

/** The sign of `new Intl.Collator(locale).compare(a, b)` (std.text); the locale is always explicit. */
export function compareText(a: string, b: string, locale: Locale): -1 | 0 | 1 {
  let collator = collators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale);
    collators.set(locale, collator);
  }
  const c = collator.compare(a, b);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}
