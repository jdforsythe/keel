import type { Claim } from "./Claim.ts";
import { cx } from "./cx.ts";
import { nextAnchor } from "./nextAnchor.ts";
import { openRegion } from "./openRegion.ts";
import { regionOf } from "./regionOf.ts";
import { serverMode } from "./serverMode.ts";
import { stands } from "./stands.ts";

/**
 * Set up a structural op at `anchor`: when not resuming, content goes before `anchor`, inside a new server region
 * when rendering a served document (`serverMode`). When resuming,
 * the server region before `anchor` is claimed by the op's first render and its closing marker becomes
 * the insertion point.
 */
export function prepare(anchor: Node): { end: Node; claim: Claim | null } {
  const outer = cx.claim;
  if (outer === null) return { end: serverMode.on ? openRegion(anchor) : anchor, claim: null };
  // A fresh anchor outside the document (an op in multi-item content, or in a k.ui element's children) stands for
  // the server's anchor at the claim's place, and leaves its fragment.
  const region = outer.region;
  const home = anchor.parentNode;
  const fresh = region !== null && (home === null || home.nodeType === 11);
  if (fresh) home?.removeChild(anchor);
  const at = fresh ? nextAnchor(region) : anchor;
  const r = regionOf(at);
  if (fresh) stands.set(anchor, [(r.nodes[0] ?? r.end).previousSibling ?? r.end, r.end, at]);
  return {
    end: r.end,
    claim: { island: null, region: { nodes: r.nodes, pos: 0, end: r.end }, session: outer.session },
  };
}
