import type { Claim } from "./Claim.ts";
import { cx } from "./cx.ts";
import { nextAnchor } from "./nextAnchor.ts";
import { openRegion } from "./openRegion.ts";
import { regionOf } from "./regionOf.ts";
import { serverMode } from "./serverMode.ts";

/**
 * Set up a structural op at `anchor`: when not resuming, content goes before `anchor`, inside a new server region
 * when rendering a served document (`serverMode`). When resuming,
 * the server region before `anchor` is claimed by the op's first render and its closing marker becomes
 * the insertion point.
 */
export function prepare(anchor: Node): { end: Node; claim: Claim | null } {
  const outer = cx.claim;
  if (outer === null) return { end: serverMode.on ? openRegion(anchor) : anchor, claim: null };
  // A fresh anchor in a fragment (an op outside a template, as in a k.ui element's children) stands for the server's
  // anchor at the claim's place, and leaves the fragment.
  const region = outer.region;
  const fresh = anchor.parentNode?.nodeType === 11 && region !== null;
  if (fresh) anchor.parentNode?.removeChild(anchor);
  const r = regionOf(fresh ? nextAnchor(region) : anchor);
  return { end: r.end, claim: { island: null, region: { nodes: r.nodes, pos: 0 }, session: outer.session } };
}
