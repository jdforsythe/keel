import { Mismatch } from "../internal/Mismatch.ts";
import { consumed } from "../internal/consumed.ts";
import { cx } from "../internal/cx.ts";
import { openRegion } from "../internal/openRegion.ts";
import { regionOf } from "../internal/regionOf.ts";
import { serverMode } from "../internal/serverMode.ts";

/**
 * Put a template child's output (a component, a nested element, a slot call) in place of its anchor `at`. A
 * component slot `<!--+-->` holds one element; any other slot, rendering a served document (`serverMode`), writes
 * its output in a server region before `at`, which stays. While resuming, an element in that place is the server
 * node: the output claims it as its root, and anything else is a mismatch (E1253); at any other anchor the output
 * claims the nodes of the region before it in order, and a server element it leaves is a mismatch.
 */
export function slot(at: ChildNode, render: () => Node | string): void {
  const claim = cx.claim;
  if (claim === null) {
    if (!serverMode.on || at.nodeValue === "+") at.replaceWith(render());
    else {
      const out = render();
      const close = openRegion(at);
      close.parentNode?.insertBefore(typeof out === "string" ? document.createTextNode(out) : out, close);
    }
    return;
  }
  if (at instanceof Element) {
    cx.claim = { island: at, region: null, session: claim.session };
    try {
      if (render() !== at) throw new Mismatch("a child did not render the server element in its place");
    } finally {
      cx.claim = claim;
    }
    return;
  }
  const r = regionOf(at);
  const inner = { island: null, region: { nodes: r.nodes, pos: 0 }, session: claim.session };
  cx.claim = inner;
  try {
    render();
  } finally {
    cx.claim = claim;
  }
  consumed(inner);
}
