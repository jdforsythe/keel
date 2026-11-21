import { shapeOf } from "./shapeOf.ts";

const isMark = (n: Node | null, v: string): boolean => n?.nodeType === 8 && n.nodeValue === v;

/**
 * Give a claimed server element the text nodes its template has: HTML has no empty text node, so an empty dynamic
 * text is missing from server HTML and every later `childNodes[i]` would be off by one. Where the template has a
 * text and the server node is not one, an empty text is inserted. Server regions are skipped, and so are the elements
 * beyond the first that the template's last component slot holds (`sameShape`) with the nodes between them: an element
 * that has any gets an own `childNodes` without them, so the compiled output's `childNodes[i]` reads the template's
 * positions; it is listed in `shadowed`, whose owner deletes it when the claim ends.
 */
export function alignTexts(tpl: Element, server: Element, shadowed?: Element[]): void {
  let extra = shapeOf(server).length - shapeOf(tpl).length;
  const slots = [...tpl.childNodes].filter((n) => isMark(n, "+"));
  const lastSlot = slots[slots.length - 1];
  const hidden = new Set<Node>();
  let s = server.firstChild;
  let regions = false;
  for (const t of tpl.childNodes) {
    let depth = 0;
    while (s !== null && (depth > 0 || isMark(s, "["))) {
      regions = true;
      if (isMark(s, "[")) depth++;
      else if (isMark(s, "]")) depth--;
      s = s.nextSibling;
    }
    if (t.nodeType === 3 && s?.nodeType !== 3) server.insertBefore(server.ownerDocument.createTextNode(""), s);
    else {
      if (t instanceof Element && s instanceof Element) alignTexts(t, s, shadowed);
      s = s?.nextSibling ?? null;
      for (; t === lastSlot && extra > 0 && s !== null; s = s.nextSibling) {
        hidden.add(s);
        if (s instanceof Element) extra--;
      }
    }
  }
  if ((!regions && hidden.size === 0) || shadowed === undefined) return;
  let depth = 0;
  const kept = [...server.childNodes].filter((n) => {
    if (isMark(n, "[")) depth++;
    else if (isMark(n, "]")) depth--;
    else return depth === 0 && !hidden.has(n);
    return false;
  });
  Object.defineProperty(server, "childNodes", { configurable: true, value: kept });
  shadowed.push(server);
}
