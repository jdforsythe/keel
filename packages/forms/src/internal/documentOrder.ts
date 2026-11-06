const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING

/** Sort comparator for elements in document order. */
export function documentOrder(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & FOLLOWING ? -1 : 1;
}
