/** The id of `node` or its nearest ancestor element that has one (`id`, else `data-k`); "" if none. */
export function idOf(node: Node | null): string {
  for (let n = node; n !== null; n = n.parentNode) {
    if (n instanceof Element) {
      const id = n.id || n.getAttribute("data-k");
      if (id) return id;
    }
  }
  return "";
}
