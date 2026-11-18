import { element } from "@keel/runtime-dom/ops";

/**
 * A `<tag>` element filled by `fill`, through the runtime's `element`: while resuming, the server element in its
 * place. A claimed element's own text is dropped first, as `fill` creates it again; its comments, the server regions
 * and op anchors the ops claim, stay with what the regions hold.
 */
export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  fill: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  return element(tag, (el) => {
    let depth = 0;
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 8) depth += n.nodeValue === "[" ? 1 : n.nodeValue === "]" ? -1 : 0;
      else if (n.nodeType === 3 && depth === 0) n.remove();
    }
    fill(el);
  });
}
