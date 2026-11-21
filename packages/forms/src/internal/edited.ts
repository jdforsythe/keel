import type { Bindable } from "./Bindable.ts";

/**
 * True when a control's state differs from its markup default (rfc:0062, backlog 0180): server HTML loaded and the
 * user changed it before `bind`. Defaults are read from markup (`value` attribute, textarea text, `checked`, the last
 * option marked `selected` or else the first enabled one), as the server DOM has no `default*` properties.
 */
export function edited(el: Bindable): boolean {
  if (el instanceof HTMLSelectElement) {
    const all = Array.from(el.options);
    const def = all.filter((o) => o.hasAttribute("selected")).at(-1) ?? all.find((o) => !o.disabled);
    return el.value !== (def?.value ?? "");
  }
  if (el instanceof HTMLTextAreaElement) return el.value !== (el.textContent ?? "");
  if (el.type === "checkbox" || el.type === "radio") return el.checked !== el.hasAttribute("checked");
  return el.value !== (el.getAttribute("value") ?? "");
}
