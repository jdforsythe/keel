import { focusable } from "./focusable.ts";

/**
 * The ids of the elements under `root` in sequential focus order (k.a11y Order and focus): focusable ones (not
 * disabled, not under `hidden`, `inert` or `display: none`) without a negative `tabindex`; a positive `tabindex`
 * first, by value, then document order. An element without an id is `""`.
 */
export function focusOrder(root: Element): string[] {
  const tab = (el: Element): number => {
    const n = Number.parseInt(el.getAttribute("tabindex") ?? "0", 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const els = Array.from(root.querySelectorAll("*")).filter((el) => focusable(el) && tab(el) >= 0);
  const first = els.filter((el) => tab(el) > 0).sort((a, b) => tab(a) - tab(b));
  return [...first, ...els.filter((el) => tab(el) === 0)].map((el) => el.id);
}
