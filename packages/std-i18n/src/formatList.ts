import { defect } from "@keel/schema";
import type { Locale } from "./Locale.schema.ts";
import { refusing } from "./internal/refusing.ts";

/**
 * `items` joined for `locale` (std.i18n): `new Intl.ListFormat(locale, { type, style }).format(items)`; what `Intl`
 * refuses raises a defect (`formatList: ...`) whose `cause` names the class `Intl` threw.
 */
export function formatList(
  items: readonly string[],
  locale: Locale,
  type: "conjunction" | "disjunction" | "unit",
  style: "long" | "short" | "narrow",
): string {
  const r = refusing(() => new Intl.ListFormat(locale, { type, style }).format(items));
  return r.ok ? r.value : defect("formatList: Intl refuses the list", { cause: r.error });
}
