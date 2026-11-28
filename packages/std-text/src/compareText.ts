import { type Locale, collate } from "@keel/std-i18n";

/** The sign of `new Intl.Collator(locale).compare(a, b)` (std.text), through `collate` of `@keel/std-i18n`; the locale is always explicit. */
export function compareText(a: string, b: string, locale: Locale): -1 | 0 | 1 {
  const c = collate(a, b, locale);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}
