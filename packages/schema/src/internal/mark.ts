import type { PiiClass } from "../PiiClass.ts";
import type { Node } from "./Node.ts";
import { formats } from "./formats.ts";

/**
 * `node` with the mark `cls`. An optional node marks its inner node, so `.nullable()` after `.pii()` keeps
 * the mark; a format node keeps its predicate and generator.
 */
export function mark(node: Node, cls: PiiClass): Node {
  if (node.kind === "optional") return { ...node, inner: mark(node.inner, cls) };
  const marked: Node = { ...node, pii: cls };
  const impl = formats.get(node);
  if (impl !== undefined) formats.set(marked, impl);
  return marked;
}
