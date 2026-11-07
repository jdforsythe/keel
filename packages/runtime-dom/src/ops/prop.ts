import { bind } from "../internal/bind.ts";
import { idOf } from "../internal/idOf.ts";
import { safeUrl } from "../url/safeUrl.ts";

/** Bind DOM property `name` of `el` to `fn` (string values of URL properties pass through `safeUrl`). */
export function prop(el: Element, name: string, fn: () => unknown): void {
  bind("prop", idOf(el), () => {
    const raw = fn();
    const v = typeof raw === "string" ? safeUrl(name, raw) : raw;
    if (!Object.is(Reflect.get(el, name), v)) Reflect.set(el, name, v);
  });
}
