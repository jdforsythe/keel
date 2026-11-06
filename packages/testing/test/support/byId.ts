/** The element with `id` inside `root` (inclusive), by walking children; tests never use selectors (E1701). */
export function byId(root: Element, id: string): Element {
  if (root.id === id) return root;
  for (const child of Array.from(root.children)) {
    const hit = child.id === id ? child : findIn(child, id);
    if (hit !== null) return hit;
  }
  throw new Error(`test support: no element ${id}`);
}

function findIn(el: Element, id: string): Element | null {
  for (const child of Array.from(el.children)) {
    if (child.id === id) return child;
    const hit = findIn(child, id);
    if (hit !== null) return hit;
  }
  return null;
}
