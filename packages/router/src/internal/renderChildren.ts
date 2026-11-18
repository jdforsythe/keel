import { parts } from "@keel/runtime-dom/ops";
import type { ChildInput } from "../types/ChildInput.ts";

/** Resolve `children` to the nodes it renders: the thunk is called, text becomes a text node, content claimed while resuming is its parts. */
export function renderChildren(children: ChildInput): Node[] {
  const v = children?.();
  if (v === undefined) return [];
  if (typeof v === "string") return [document.createTextNode(v)];
  if (v instanceof Node) return [...(parts(v) ?? [v])];
  return [...v];
}
