import { cx } from "../internal/cx.ts";
import { heldOf } from "../internal/heldOf.ts";
import { nodesOf } from "../internal/nodesOf.ts";
import { partsOf } from "../internal/partsOf.ts";
import { stands } from "../internal/stands.ts";

/** What multi-item content appends its items to. */
type Sink = { append(...items: (Node | string)[]): void; appendChild<T extends Node>(node: T): T };

/** Texts `frag` put in place while resuming: a later text of the same content goes after them. */
const fresh = new WeakSet<Node>();

/**
 * Multi-item content (compiled JSX children, a fragment): `build` appends the items to `f` in order. Outside a claim
 * `f` is the fragment returned. While resuming nothing moves: an element item claimed its server node where it is, a
 * text replaces the server's text at the cursor, and an op's anchor stands for the region it claimed; the empty
 * fragment returned has those nodes as its parts (`partsOf`), in document order.
 */
export function frag(build: (f: Sink) => void): DocumentFragment {
  const out = document.createDocumentFragment();
  const claim = cx.claim;
  if (claim === null) {
    build(out);
    return out;
  }
  const r = claim.region;
  const items: Node[] = [];
  const put = (x: Node | string): void => {
    if (typeof x !== "string") {
      const held = heldOf.get(x);
      const p = partsOf.get(x) ?? (held === undefined ? undefined : nodesOf(held.nodes ?? []));
      if (p !== undefined) items.push(...p);
      if (p !== undefined || x.parentNode !== null || x.nodeType === 8) {
        if (p === undefined) items.push(x);
        return;
      }
    }
    const n = typeof x === "string" ? document.createTextNode(x) : x;
    items.push(n);
    if (r === null) return;
    for (let s = r.nodes[r.pos]; s?.nodeType === 3; s = r.nodes[++r.pos]) s.parentNode?.removeChild(s);
    const ref = r.nodes[r.pos] ?? r.end ?? null;
    const parent = ref?.parentNode ?? r.parent ?? null;
    if (parent === null) return;
    for (let s = ref === null ? parent.lastChild : ref.previousSibling; s?.nodeType === 3 && !fresh.has(s); ) {
      const prev: ChildNode | null = s.previousSibling;
      parent.removeChild(s);
      s = prev;
    }
    parent.insertBefore(n, ref);
    fresh.add(n);
  };
  build({
    append: (...xs) => {
      for (const x of xs) put(x);
    },
    appendChild: (x) => {
      put(x);
      return x;
    },
  });
  partsOf.set(
    out,
    items.flatMap((n) => stands.get(n) ?? (n.nodeType === 8 && n.parentNode === null ? [] : [n])),
  );
  return out;
}
