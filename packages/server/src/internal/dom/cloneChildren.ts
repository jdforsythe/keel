import type { ServerNode } from "./ServerNode.ts";

/** Append a copy of each child of `from` to `to` (the deep part of `cloneNode`). */
export function cloneChildren(from: ServerNode, to: ServerNode): void {
  for (const c of from.childNodes) to.appendChild(c.cloneNode(true));
}
