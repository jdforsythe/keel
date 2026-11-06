/**
 * Advance a region cursor to its next element at depth 0, skipping whitespace text and comments.
 * Returns null at the end; a non-whitespace text node returns "text" (a mismatch).
 */
export function nextClaimable(region: { readonly nodes: readonly Node[]; pos: number }): Element | "text" | null {
  while (region.pos < region.nodes.length) {
    const n = region.nodes[region.pos++];
    if (n instanceof Element) return n;
    if (n !== undefined && n.nodeType === 3 && (n.nodeValue ?? "").trim() !== "") return "text";
  }
  return null;
}
