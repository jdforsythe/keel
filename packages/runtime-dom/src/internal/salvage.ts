const isMark = (n: Node, v: string): boolean => n.nodeType === 8 && n.nodeValue === v;

/** The first `<!--k-->` comment below `n`, in document order, or null. */
const markerIn = (n: Node): Node | null => {
  for (let c = n.firstChild; c !== null; c = c.nextSibling) {
    if (isMark(c, "k")) return c;
    const found = markerIn(c);
    if (found !== null) return found;
  }
  return null;
};

/**
 * The child level's content in a server island element whose claim failed before its `children` call (k.resume
 * Nested islands): the server writes `<!--k-->` first in a child level's content, so it is the nodes from the first
 * such comment in `el` to the end of the region it sits in (its closing `<!--]-->` excluded), else nothing.
 */
export function salvage(el: Element): Node[] {
  const marker = markerIn(el);
  const out: Node[] = [];
  let depth = 0;
  for (let p = marker; p !== null; p = p.nextSibling) {
    if (isMark(p, "[")) depth++;
    else if (isMark(p, "]") && depth-- === 0) break;
    out.push(p);
  }
  return out;
}
