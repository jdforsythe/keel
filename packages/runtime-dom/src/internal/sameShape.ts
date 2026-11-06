import { shapeOf } from "./shapeOf.ts";

/** Compare a template element with a server element (tags and element structure); a description if they differ. */
export function sameShape(tpl: Element, server: Element): string | null {
  if (tpl.tagName !== server.tagName) return `<${server.localName}> where the template has <${tpl.localName}>`;
  const a = shapeOf(tpl);
  const b = shapeOf(server);
  if (a.length !== b.length)
    return `<${server.localName}> has ${b.length} child elements where the template has ${a.length}`;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined) return "child count";
    const d = sameShape(x, y);
    if (d !== null) return d;
  }
  return null;
}
