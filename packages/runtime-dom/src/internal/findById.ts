const matches = (el: Element, id: string): boolean => el.id === id || el.getAttribute("data-k") === id;

const search = (el: Element, id: string): Element | null => {
  if (matches(el, id)) return el;
  for (const c of el.children) {
    const hit = search(c, id);
    if (hit !== null) return hit;
  }
  return null;
};

/** Find the element with `id` (or `data-k`) in the given render roots, newest root first. */
export function findById(roots: readonly Element[], id: string): Element | null {
  for (let i = roots.length - 1; i >= 0; i--) {
    const r = roots[i];
    const hit = r === undefined ? null : search(r, id);
    if (hit !== null) return hit;
  }
  return null;
}
