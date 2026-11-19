import type { FormatImpl } from "./FormatImpl.ts";
import type { Node } from "./Node.ts";

/** Format nodes to their in-memory predicate and generator; the node itself stays plain JSON. */
export const formats: WeakMap<Node, FormatImpl> = new WeakMap();
