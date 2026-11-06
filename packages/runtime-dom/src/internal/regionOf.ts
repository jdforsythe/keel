import { Mismatch } from "./Mismatch.ts";

/**
 * The server-rendered content of a structural op: the nodes between `<!--[-->` and `<!--]-->` placed
 * immediately before `anchor`. `end` (the closing marker) becomes the op's insertion point.
 */
export function regionOf(anchor: Node): { nodes: Node[]; end: Node } {
  const end = anchor.previousSibling;
  if (end === null || end.nodeType !== 8 || end.nodeValue !== "]")
    throw new Mismatch("no server region <!--[-->...<!--]--> before a structural anchor");
  const nodes: Node[] = [];
  let depth = 0;
  for (let n = end.previousSibling; n !== null; n = n.previousSibling) {
    if (n.nodeType === 8 && n.nodeValue === "]") depth++;
    if (n.nodeType === 8 && n.nodeValue === "[") {
      if (depth === 0) return { nodes: nodes.reverse(), end };
      depth--;
    }
    nodes.push(n);
  }
  throw new Mismatch("unterminated server region before a structural anchor");
}
