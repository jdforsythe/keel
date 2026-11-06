/**
 * The structural shape of an element's children for E1253: child elements only. Text and comments are
 * dynamic or anchors; a server region `<!--[-->...<!--]-->` (structural-op content) is skipped whole.
 */
export function shapeOf(el: Element): Element[] {
  const out: Element[] = [];
  let depth = 0;
  for (const n of el.childNodes) {
    if (n.nodeType === 8) {
      if (n.nodeValue === "[") depth++;
      else if (n.nodeValue === "]" && depth > 0) depth--;
    } else if (depth === 0 && n instanceof Element) out.push(n);
  }
  return out;
}
