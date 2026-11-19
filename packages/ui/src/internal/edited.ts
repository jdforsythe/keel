/**
 * True when a control's state differs from its markup default (`value` attribute, textarea text, `checked`, the
 * last option marked `selected` or else the first enabled one): the user changed it before resume (rfc:0064).
 * The same test as k.forms `bind` (rfc:0062).
 */
export function edited(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLSelectElement) {
    const all = Array.from(el.options);
    const def = all.filter((o) => o.hasAttribute("selected")).at(-1) ?? all.find((o) => !o.disabled);
    return el.value !== (def?.value ?? "");
  }
  if (el instanceof HTMLTextAreaElement) return el.value !== (el.textContent ?? "");
  if (el.type === "checkbox") return el.checked !== el.hasAttribute("checked");
  return el.value !== (el.getAttribute("value") ?? "");
}
