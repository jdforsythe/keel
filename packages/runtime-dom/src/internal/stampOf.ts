/**
 * The id the compiler wrote for `node`: the `data-k` of `node` or of its nearest ancestor element with a non-empty
 * one; "" if none. Never an element's `id`, which a binding can set from app data (k.errors `data.at`).
 */
export function stampOf(node: Node | null): string {
  for (let n = node; n !== null; n = n.parentNode) {
    if (n instanceof Element) {
      const k = n.getAttribute("data-k");
      if (k) return k;
    }
  }
  return "";
}
