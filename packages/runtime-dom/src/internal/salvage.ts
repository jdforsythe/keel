/** The nodes of the region that `n` sits in directly, or null when it sits in none. */
const regionAround = (n: Node): Node[] | null => {
  let depth = 0;
  let open: Node | null = null;
  for (let p = n.previousSibling; p !== null && open === null; p = p.previousSibling) {
    if (p.nodeType !== 8) continue;
    if (p.nodeValue === "]") depth++;
    else if (p.nodeValue === "[" && depth-- === 0) open = p;
  }
  if (open === null) return null;
  const out: Node[] = [];
  depth = 0;
  for (let p = open.nextSibling; p !== null; p = p.nextSibling) {
    if (p.nodeType === 8 && p.nodeValue === "[") depth++;
    if (p.nodeType === 8 && p.nodeValue === "]" && depth-- === 0) return out;
    out.push(p);
  }
  return null;
};

/**
 * The child level's content in a server island element whose claim failed before its `children` call: the
 * outermost region below `el` around its first nested island root, else nothing.
 */
export function salvage(el: Element): Node[] {
  let found: Node[] = [];
  for (let n: Node | null = el.querySelector("[data-k-island]"); n !== null && n !== el; n = n.parentNode)
    found = regionAround(n) ?? found;
  return found;
}
