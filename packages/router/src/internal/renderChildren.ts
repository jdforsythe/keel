/** Children of a component (RFC 0008): a thunk, or a plain node, string, or array from hand-built calls. */
export type ChildInput = (() => Node | readonly Node[] | string) | Node | readonly Node[] | string | undefined;

/** Resolve `children` (RFC 0008) to the nodes it renders: a thunk is called, text becomes a text node. */
export function renderChildren(children: ChildInput): Node[] {
  const v = typeof children === "function" ? children() : children;
  if (v === undefined) return [];
  if (typeof v === "string") return [document.createTextNode(v)];
  if (v instanceof Node) return [v];
  return [...v];
}
