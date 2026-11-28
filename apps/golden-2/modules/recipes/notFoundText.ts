import type { AppLocale } from "./AppLocale.schema.ts";
import deDE from "./RecipeErrorText/de-DE.ts";
import enUS from "./RecipeErrorText/en-US.ts";
import jaJP from "./RecipeErrorText/ja-JP.ts";

const TEXT: Readonly<Record<AppLocale, string>> = {
  "en-US": enUS.notFound,
  "de-DE": deDE.notFound,
  "ja-JP": jaJP.notFound,
};

/** The `notFound` text of `locale` (`RecipeErrorText`), for the error element, which gets no loader data to read an entry from. */
export function notFoundText(locale: AppLocale): string {
  return TEXT[locale];
}
