import { element } from "@keel/runtime-dom/ops";

/**
 * A `<tag>` element filled by `fill`, through the runtime's `element`: while resuming, the server element in its
 * place (rfc:0064). A claimed element's text and comments are dropped first, as `fill` creates them again.
 */
export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  fill: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  return element(tag, (el) => {
    for (const n of [...el.childNodes]) if (n.nodeType !== 1) n.remove();
    fill(el);
  });
}
