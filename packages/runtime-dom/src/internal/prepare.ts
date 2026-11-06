import type { Claim } from "./Claim.ts";
import { cx } from "./cx.ts";
import { regionOf } from "./regionOf.ts";

/**
 * Set up a structural op at `anchor`: when not resuming, content goes before `anchor`. When resuming,
 * the server region before `anchor` is claimed by the op's first render and its closing marker becomes
 * the insertion point.
 */
export function prepare(anchor: Node): { end: Node; claim: Claim | null } {
  const outer = cx.claim;
  if (outer === null) return { end: anchor, claim: null };
  const r = regionOf(anchor);
  return { end: r.end, claim: { island: null, region: { nodes: r.nodes, pos: 0 }, session: outer.session } };
}
