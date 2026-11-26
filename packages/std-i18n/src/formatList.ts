import type { Locale } from "./Locale.schema.ts";
import { refusing } from "./internal/refusing.ts";

/**
 * `items` joined for `locale` (std.i18n): `new Intl.ListFormat(locale, { type, style }).format(items)`; what `Intl`
 * refuses throws a `RangeError` (`formatList: ...`).
 */
export function formatList(
  items: readonly string[],
  locale: Locale,
  type: "conjunction" | "disjunction" | "unit",
  style: "long" | "short" | "narrow",
): string {
  return refusing("formatList", () => new Intl.ListFormat(locale, { type, style }).format(items));
}
