import type { ChildInput } from "../types/ChildInput.ts";

/** Resolve `children` (RFC 0008) to the nodes it renders: a thunk is called, text becomes a text node. */
export function renderChildren(children: ChildInput): Node[] {
  const v = typeof children === "function" ? children() : children;
  if (v === undefined) return [];
  if (typeof v === "string") return [document.createTextNode(v)];
  if (v instanceof Node) return [v];
  return [...v];
}
