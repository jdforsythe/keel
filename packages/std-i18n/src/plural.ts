import type { Locale } from "./Locale.ts";
import type { PluralForms } from "./PluralForms.ts";
import { formatNumber } from "./formatNumber.ts";

/**
 * The form `Intl.PluralRules` selects for `n` in `locale`, else `other`, with each `#` replaced by
 * `formatNumber(n, locale)` (std.i18n). The one plural path; std.messages uses it.
 */
export function plural(n: number, locale: Locale, forms: PluralForms): string {
  const form = forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
  return form.split("#").join(formatNumber(n, locale));
}
