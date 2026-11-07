import { Mismatch } from "../internal/Mismatch.ts";
import { cx } from "../internal/cx.ts";

/**
 * Put a template child's output (a component, a nested element, a slot call) in place of its anchor `at`. While
 * resuming, an element in that place is the server node: the output claims it as its root, and anything else is a
 * mismatch (E1253). The template's `<!--+-->` slots require that element (rfc:0064).
 */
export function slot(at: ChildNode, render: () => Node | string): void {
  const claim = cx.claim;
  if (claim === null || !(at instanceof Element)) {
    at.replaceWith(render());
    return;
  }
  cx.claim = { island: at, region: null, session: claim.session };
  try {
    if (render() !== at) throw new Mismatch("a child did not render the server element in its place");
  } finally {
    cx.claim = claim;
  }
}
