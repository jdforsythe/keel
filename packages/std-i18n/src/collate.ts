import type { Locale } from "./Locale.schema.ts";

const collators = new Map<Locale, Intl.Collator>();

/** `new Intl.Collator(locale).compare(a, b)` (std.i18n), one collator per locale held across calls; reads no host locale. */
export function collate(a: string, b: string, locale: Locale): number {
  let collator = collators.get(locale);
  if (collator === undefined) {
    collator = new Intl.Collator(locale);
    collators.set(locale, collator);
  }
  return collator.compare(a, b);
}
