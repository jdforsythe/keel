import type { Bindable } from "./Bindable.ts";

const mark = (el: Element, name: string, on: boolean): void => {
  if (el.hasAttribute(name) === on) return;
  if (on) el.setAttribute(name, "");
  else el.removeAttribute(name);
};

/**
 * Write a bound control's current state as its markup default (k.forms Bindings, rfc:0062): an input's `value`
 * attribute, a textarea's text, `selected` on each option, `checked` on a checkbox or radio. A browser reads these as
 * the default, so server HTML shows the value before the runtime loads and a user's edit is never replaced. A
 * `password` or `file` input keeps no `value` attribute: a secret is never written into the markup.
 */
export function markDefault(el: Bindable): void {
  if (el instanceof HTMLSelectElement) {
    for (const o of Array.from(el.options)) mark(o, "selected", o.selected);
  } else if (el instanceof HTMLTextAreaElement) {
    if (el.textContent !== el.value) el.textContent = el.value;
  } else if (el.type === "checkbox" || el.type === "radio") mark(el, "checked", el.checked);
  else if (el.type !== "password" && el.type !== "file" && (el.getAttribute("value") ?? "") !== el.value)
    el.setAttribute("value", el.value);
}
