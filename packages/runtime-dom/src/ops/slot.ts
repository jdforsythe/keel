import { Mismatch } from "../internal/Mismatch.ts";
import { consumed } from "../internal/consumed.ts";
import { cx } from "../internal/cx.ts";
import { made } from "../internal/made.ts";
import { openRegion } from "../internal/openRegion.ts";
import { partsOf } from "../internal/partsOf.ts";
import { placed } from "../internal/placed.ts";
import { regionOf } from "../internal/regionOf.ts";
import { serverMode } from "../internal/serverMode.ts";

/**
 * Put a template child's output (a component, a nested element, a slot call) in place of its anchor `at`. A
 * component slot `<!--+-->` holds the component's output; any other slot, rendering a served document (`serverMode`), writes
 * its output in a server region before `at`, which stays. While resuming, an element in that place is the server
 * node: the output claims it and the nodes after it in order, starting with it, and anything else is a mismatch
 * (E1253); at any other anchor the output claims the nodes of the region before it in order, and a server element it
 * leaves is a mismatch. Nothing claimed moves.
 */
export function slot(at: ChildNode, render: () => Node | string): void {
  const claim = cx.claim;
  if (claim === null) {
    const start = made.seq;
    const out = render();
    if (typeof out !== "string") placed(start, out.nodeType === 11 ? out.childNodes : [out]);
    if (!serverMode.on || at.nodeValue === "+") at.replaceWith(out);
    else {
      const close = openRegion(at);
      close.parentNode?.insertBefore(typeof out === "string" ? document.createTextNode(out) : out, close);
    }
    return;
  }
  if (at instanceof Element) {
    const nodes: Node[] = [];
    for (let n: Node | null = at; n !== null; n = n.nextSibling) nodes.push(n);
    cx.claim = { island: null, region: { nodes, pos: 0, end: null, parent: at.parentNode }, session: claim.session };
    try {
      const out = render();
      if (out !== at && (typeof out === "string" || partsOf.get(out)?.[0] !== at))
        throw new Mismatch("a child did not render the server element in its place");
    } finally {
      cx.claim = claim;
    }
    return;
  }
  const r = regionOf(at);
  const inner = { island: null, region: { nodes: r.nodes, pos: 0, end: r.end }, session: claim.session };
  cx.claim = inner;
  try {
    render();
  } finally {
    cx.claim = claim;
  }
  consumed(inner);
}
