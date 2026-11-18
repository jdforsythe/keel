/** Write an empty server region `<!--[--><!--]-->` right before `anchor`; returns its closing marker. */
export function openRegion(anchor: Node): Node {
  const p = anchor.parentNode;
  const close = document.createComment("]");
  p?.insertBefore(document.createComment("["), anchor);
  p?.insertBefore(close, anchor);
  return close;
}
