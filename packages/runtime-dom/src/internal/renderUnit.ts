import { effect } from "@keel/reactive";
import type { Catcher } from "./Catcher.ts";
import type { Claim } from "./Claim.ts";
import { Mismatch } from "./Mismatch.ts";
import type { Owner } from "./Owner.ts";
import type { Unit } from "./Unit.ts";
import { createOwner } from "./createOwner.ts";
import { disposeOwner } from "./disposeOwner.ts";
import { report } from "./report.ts";
import { withCx } from "./withCx.ts";

/**
 * Render `render()` as a unit owned by the running reactive owner, inserted before `anchor` (or claimed
 * in place when `claim` is given, on the first run only). The render runs in its own effect so its reads
 * do not subscribe the structural op; if one of them changes, the unit re-renders client-side. A throw
 * goes to `catcher` (the unit owner's Boundary); a hydration mismatch goes to the claim's session.
 */
export function renderUnit(
  parent: Owner,
  catcher: Catcher | null,
  anchor: Node,
  render: () => Node,
  claim: Claim | null,
  at: string,
  onRendered?: () => void,
): Unit {
  let nodes: Node[] = [];
  let owner: Owner | null = null;
  let first = true;
  const clear = (): void => {
    if (owner !== null) disposeOwner(owner);
    owner = null;
    for (const n of nodes) n.parentNode?.removeChild(n);
    nodes = [];
  };
  const e = effect(
    () => {
      const hydrate = first ? claim : null;
      first = false;
      clear();
      if (parent.gone) return;
      const o = createOwner(parent, parent.root, catcher);
      owner = o;
      let out: Node;
      try {
        out = withCx(o, hydrate, render);
      } catch (error) {
        if (error instanceof Mismatch && hydrate !== null) {
          hydrate.session.failed ??= error;
          return;
        }
        report(o, error, at);
        return;
      }
      nodes = out.nodeType === 11 ? [...out.childNodes] : [out];
      if (hydrate === null) anchor.parentNode?.insertBefore(out, anchor);
      onRendered?.();
    },
    { writes: catcher === null ? [] : [catcher.state] },
  );
  return {
    nodes: () => nodes,
    dispose() {
      e.dispose();
      clear();
    },
  };
}
