import type { Claim } from "./Claim.ts";
import type { Owner } from "./Owner.ts";

/**
 * Render context, set while a mount, island, branch, row, or boundary renders and read by the ops:
 * the owner new bindings belong to, the elements cloned so far (for `on(id)`), and the hydration cursor.
 */
export const cx: { owner: Owner | null; nodes: Element[]; claim: Claim | null } = {
  owner: null,
  nodes: [],
  claim: null,
};
