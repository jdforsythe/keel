import { attr } from "@keel/runtime-dom/ops";
import type { Value } from "@keel/runtime-dom/ops";
import { safeUrl } from "@keel/runtime-dom/url";

/**
 * Attribute `name` of `el` from `read()`, written now (so markup keeps its attribute order) and, when `live` (the
 * prop is a getter), kept by an `attr` binding: a kept `For` row or a later prop change shows the new value.
 * `null`, `undefined` and `false` mean absent, `true` an empty value; URL attributes pass through `safeUrl`. A
 * binding alone does not mark `el` bound (`data-k`): a compiled expression may be static.
 */
export function attrOf(el: Element, name: string, live: boolean, read: () => Value): void {
  const v = read();
  if (v !== null && v !== undefined && v !== false) el.setAttribute(name, safeUrl(name, v === true ? "" : String(v)));
  if (live) attr(el, name, read);
}
