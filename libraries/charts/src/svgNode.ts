const SVG = "http://www.w3.org/2000/svg";

/** An SVG element of `tag` made in `doc`, with `attrs` set as attributes; the policy allows attributes, not `style`. */
export function svgNode(doc: Document, tag: string, attrs: Readonly<Record<string, string | number>>): Element {
  const el = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
