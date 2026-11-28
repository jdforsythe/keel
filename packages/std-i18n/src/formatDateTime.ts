import { defect } from "@keel/schema";
import type { Locale } from "./Locale.schema.ts";
import { refusing } from "./internal/refusing.ts";

/**
 * The time `t` (milliseconds since the epoch) written for `locale` (std.i18n): `Intl.DateTimeFormat` with `options`,
 * whose `timeZone` is required, so neither the host locale nor the host time zone is read. A `timeZone` that is no
 * non-empty string, and a `t` or options `Intl` refuses, raise a defect (`formatDateTime: ...`).
 */
export function formatDateTime(
  t: number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions & { readonly timeZone: string },
): string {
  const zone: unknown = typeof options === "object" && options !== null ? Reflect.get(options, "timeZone") : undefined;
  if (typeof zone !== "string" || zone === "") return defect("formatDateTime: timeZone is required");
  const r = refusing(() => new Intl.DateTimeFormat(locale, options).format(t));
  return r.ok
    ? r.value
    : defect("formatDateTime: Intl refuses the time or the options", { data: { timeZone: zone }, cause: r.error });
}
