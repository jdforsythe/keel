import type { A11yNode } from "../types/A11yNode.ts";
import { isHidden } from "./isHidden.ts";
import { nodeOf } from "./nodeOf.ts";

/**
 * The a11y nodes directly below `parent`: each id-bearing element becomes a node; elements without an id are
 * transparent (their id-bearing descendants are lifted); hidden subtrees are omitted.
 */
export function treeOf(parent: Element): A11yNode[] {
  const out: A11yNode[] = [];
  for (const child of Array.from(parent.children)) {
    if (isHidden(child)) continue;
    if (child.id !== "") out.push(nodeOf(child));
    else out.push(...treeOf(child));
  }
  return out;
}
