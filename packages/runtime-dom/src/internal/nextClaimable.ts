/**
 * Advance a region cursor to its next element at depth 0, skipping whitespace text, comments and nested server
 * regions `<!--[-->` … `<!--]-->` (an op inside claims those). Returns null at the end; a non-whitespace text node
 * returns "text" (a mismatch).
 */
export function nextClaimable(region: { readonly nodes: readonly Node[]; pos: number }): Element | "text" | null {
  let depth = 0;
  while (region.pos < region.nodes.length) {
    const n = region.nodes[region.pos++];
    if (n === undefined) continue;
    if (n.nodeType === 8) depth += n.nodeValue === "[" ? 1 : n.nodeValue === "]" ? -1 : 0;
    else if (depth > 0) continue;
    else if (n instanceof Element) return n;
    else if (n.nodeType === 3 && (n.nodeValue ?? "").trim() !== "") return "text";
  }
  return null;
}
