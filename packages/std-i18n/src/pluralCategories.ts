import type { Locale } from "./Locale.schema.ts";

/** The plural categories `locale` selects (std.i18n): `new Intl.PluralRules(locale).resolvedOptions().pluralCategories`. */
export function pluralCategories(locale: Locale): readonly string[] {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}
