import { attr } from "@keel/runtime-dom/ops";
import type { Value } from "@keel/runtime-dom/ops";
import { bound } from "./bound.ts";
import { isGetter } from "./isGetter.ts";
import { isReadable } from "./isReadable.ts";

/**
 * Attribute `name` of `el` from prop `k`, formatted by `fmt` (`null` or `false` absent, `true` an empty value): a
 * signal, a computed or a compiled getter binds it (a signal or computed marks `el` bound); a plain value is written
 * once; a prop not given writes nothing.
 */
export function put(
  el: Element,
  props: Readonly<Record<string, unknown>>,
  k: string,
  name: string,
  fmt: (v: unknown) => Value,
): void {
  if (!(k in props)) return;
  const v = props[k];
  if (isGetter(props, k) || isReadable(v)) {
    if (isReadable(v)) bound(el);
    attr(el, name, () => {
      const now = props[k];
      return fmt(isReadable(now) ? now.get() : now);
    });
  } else {
    const s = fmt(v);
    if (s !== null && s !== false) el.setAttribute(name, s === true ? "" : String(s));
  }
}
