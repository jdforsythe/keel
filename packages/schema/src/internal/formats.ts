import type { FormatImpl } from "./FormatImpl.ts";
import type { Node } from "./Node.ts";
import type { WeakMapOf } from "./WeakMapOf.ts";
import { heldMap } from "./heldMap.ts";

/** Format nodes to their in-memory predicate and generator; the node itself stays plain JSON. */
export const formats: WeakMapOf<Node, FormatImpl> = heldMap();
