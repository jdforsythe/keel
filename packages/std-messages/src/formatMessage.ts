import { type Locale, formatNumber, plural } from "@keel/std-i18n";
import type { Message } from "./Message.ts";

type Params = Readonly<Record<string, string | number>>;

/**
 * Render an object message for `locale` (std.messages): `{name}` becomes its param (a number through `formatNumber`),
 * a `plural` goes through std.i18n `plural` with `params[p]`, and a `select` takes the case of `params[p]`.
 */
export function formatMessage<P extends Params>(message: Message<P>, params: NoInfer<P>, locale: Locale): string {
  const values: Params = params;
  const value = (name: string): string | number | undefined => (Object.hasOwn(values, name) ? values[name] : undefined);
  const fill = (t: string): string =>
    t.replace(/\{([A-Za-z_$][\w$]*)\}/g, (_, name: string) => {
      const v = value(name);
      return typeof v === "number" ? formatNumber(v, locale) : (v ?? "");
    });
  if ("text" in message) return fill(message.text);
  if ("plural" in message) {
    const n = value(message.plural);
    return fill(plural(typeof n === "number" ? n : Number.NaN, locale, message));
  }
  const key = String(value(message.select));
  return fill(Object.hasOwn(message.cases, key) ? (message.cases[key] ?? "") : "");
}
