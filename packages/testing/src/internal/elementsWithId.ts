/** Every element under `root` (excluded) that carries a non-empty id, in document order. */
export function elementsWithId(root: Element): Element[] {
  const out: Element[] = [];
  const walk = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (child.id !== "") out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}
