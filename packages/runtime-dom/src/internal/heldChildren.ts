import { E1255 } from "./E1255.ts";
import type { Held } from "./Held.ts";
import { cx } from "./cx.ts";
import { heldOf } from "./heldOf.ts";
import { nodesOf } from "./nodesOf.ts";

/**
 * A resumed island's `children` (k.resume Layout islands): it renders no child level. While the island claims its
 * server nodes, the call takes the rest of the region it is claiming as the held content, which stays in place
 * unclaimed; a later call moves the held nodes into the fragment it returns. Each call returns a fragment standing
 * for the held content (`heldOf`). A second call while the island builds, or a call while the content is in the
 * document, throws E1255.
 */
export function heldChildren(held: Held): () => Node {
  return () => {
    if (held.calls >= 0 && ++held.calls > 1) throw new Error(E1255);
    const f = document.createDocumentFragment();
    heldOf.set(f, held);
    const region = cx.claim?.region;
    if (region !== null && region !== undefined && held.nodes === null) {
      held.nodes = region.nodes.slice(region.pos);
      region.pos = region.nodes.length;
      return f;
    }
    const nodes = nodesOf(held.nodes ?? []);
    if (nodes.some((n) => n.isConnected)) throw new Error(E1255);
    f.append(...nodes);
    return f;
  };
}
