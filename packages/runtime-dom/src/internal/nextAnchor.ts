import { Mismatch } from "./Mismatch.ts";

/**
 * Advance a region cursor past the next server region to the op anchor right after it (k.resume Regions); an
 * element or text first, or no anchor, is a mismatch (E1253).
 */
export function nextAnchor(region: { readonly nodes: readonly Node[]; pos: number }): Node {
  let depth = 0;
  while (region.pos < region.nodes.length) {
    const n = region.nodes[region.pos++];
    if (n === undefined) continue;
    const v = n.nodeType === 8 ? n.nodeValue : null;
    if (v === "[") depth++;
    else if (v === "]") depth--;
    else if (depth > 0) continue;
    else if (v !== null) return n;
    else if (n.nodeType !== 3 || (n.nodeValue ?? "").trim() !== "") break;
  }
  throw new Mismatch("no server region and anchor where an op renders");
}
