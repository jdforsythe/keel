import type { Hydration } from "./Hydration.ts";

/**
 * Hydration cursor read by `clone`: the island root is claimed by the first clone; inside a structural
 * region, clones claim the region's server nodes in order. `end` is the node a text placed after the region's last
 * node goes before (a region's closing marker; null appends to `parent`).
 */
export interface Claim {
  island: Element | null;
  readonly region: {
    readonly nodes: readonly Node[];
    pos: number;
    readonly end?: Node | null;
    readonly parent?: Node | null;
  } | null;
  readonly session: Hydration;
}
