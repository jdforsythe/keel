import { bind } from "../internal/bind.ts";
import { idOf } from "../internal/idOf.ts";
import type { Value } from "../types/Value.ts";
import { isRefusedAttr } from "../url/isRefusedAttr.ts";
import { safeUrl } from "../url/safeUrl.ts";

/**
 * Bind attribute `name` of `el` to `fn`: `null`, `undefined`, or `false` removes it, `true` sets it empty,
 * anything else sets its string. URL attributes pass through `safeUrl` (disallowed schemes -> about:blank).
 * A refused name (`isRefusedAttr`: any `on*`, `<base>` `href`) binds nothing, so a JSX spread with an `onclick`
 * key creates no inline handler (rfc:0056). Dropped, not thrown: a key from data must not fail the Boundary.
 */
export function attr(el: Element, name: string, fn: () => Value): void {
  if (isRefusedAttr(el.localName, name)) return;
  bind("attr", idOf(el), () => {
    const v = fn();
    if (v === null || v === undefined || v === false) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
      return;
    }
    const s = safeUrl(name, v === true ? "" : String(v));
    if (el.getAttribute(name) !== s) el.setAttribute(name, s);
  });
}
