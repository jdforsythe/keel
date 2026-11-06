/** A fragment holding a fresh anchor, for intrinsics used outside compiled output. */
export function anchored(op: (anchor: Node) => void): Node {
  const f = document.createDocumentFragment();
  const a = document.createComment("");
  f.appendChild(a);
  op(a);
  return f;
}
