import type { Hydration } from "./Hydration.ts";

/**
 * Hydration cursor read by `clone`: the island root is claimed by the first clone; inside a structural
 * region, clones claim the region's server nodes in order.
 */
export interface Claim {
  island: Element | null;
  readonly region: { readonly nodes: readonly Node[]; pos: number } | null;
  readonly session: Hydration;
}
