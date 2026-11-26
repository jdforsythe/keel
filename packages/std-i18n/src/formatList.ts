import type { Locale } from "./Locale.schema.ts";

/** `items` joined for `locale` (std.i18n): `new Intl.ListFormat(locale, { type, style }).format(items)`. */
export function formatList(
  items: readonly string[],
  locale: Locale,
  type: "conjunction" | "disjunction" | "unit",
  style: "long" | "short" | "narrow",
): string {
  return new Intl.ListFormat(locale, { type, style }).format(items);
}
