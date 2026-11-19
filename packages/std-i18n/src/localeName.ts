import type { Locale } from "./Locale.ts";

/** The locale's name in its own language (std.i18n), the text of a locale switcher's link: `Deutsch (Deutschland)`. */
export function localeName(locale: Locale): string {
  return new Intl.DisplayNames([locale], { type: "language", languageDisplay: "standard" }).of(locale) ?? locale;
}
