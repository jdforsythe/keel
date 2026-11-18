import { shapeOf } from "./shapeOf.ts";

/**
 * Compare a template element with a server element (tags and element structure); a description if they differ.
 * A template's component slot matches the server element the child component rendered there; the last slot also
 * takes any elements the server has beyond the template's (a component rendering several), so the elements after it
 * compare from the end. The child component claims and checks what its slot holds.
 */
export function sameShape(tpl: Element, server: Element): string | null {
  if (tpl.tagName !== server.tagName) return `<${server.localName}> where the template has <${tpl.localName}>`;
  const a = shapeOf(tpl);
  const b = shapeOf(server);
  const extra = b.length - a.length;
  const last = a.lastIndexOf(null);
  if (extra !== 0 && (extra < 0 || last < 0))
    return `<${server.localName}> has ${b.length} child elements where the template has ${a.length}`;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i > last ? i + extra : i];
    if (x === null) continue;
    if (x === undefined || !y) return "child count";
    const d = sameShape(x, y);
    if (d !== null) return d;
  }
  return null;
}
