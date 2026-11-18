import { effect, owner as running, scope } from "@keel/reactive";
import type { Catcher } from "./Catcher.ts";
import type { Claim } from "./Claim.ts";
import { Mismatch } from "./Mismatch.ts";
import type { Owner } from "./Owner.ts";
import type { Unit } from "./Unit.ts";
import { createOwner } from "./createOwner.ts";
import { disposeOwner } from "./disposeOwner.ts";
import { heldOf } from "./heldOf.ts";
import { nodesOf } from "./nodesOf.ts";
import { report } from "./report.ts";
import { unitOwners } from "./unitOwners.ts";
import { withCx } from "./withCx.ts";

/**
 * Render `render()` as a unit owned by the running reactive owner (structural ops call it inside their
 * `home.run`, so the unit outlives reruns of their own effect), inserted before `anchor` (or claimed
 * in place when `claim` is given, on the first run only). The render runs untracked, through its scope's `run`:
 * a reactive read while the unit is built subscribes nothing, so the unit renders once and leaves only by `dispose`;
 * bindings, computeds and effects made in it update on their own. A throw
 * goes to `catcher` (the unit owner's Boundary): from the render itself, or (k.reactive `scope` onError,
 * after the commit) from any app-level effect or computed created under it. A hydration mismatch goes to
 * the claim's session. Its nodes are the top-level nodes the render returned, each preceded by what the units of
 * a structural op anchored at it rendered there (owned below this unit, `unitOwners`): those go with it when the
 * unit is moved, re-rendered or disposed. A fragment a resumed island's `children` returned stands for the held
 * content: the unit's nodes are those held nodes, wherever they are.
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
  let nodes = (): Node[] => [];
  let owner: Owner | null = null;
  let first = true;
  const below = (n: Node): boolean => {
    for (let o = unitOwners.get(n)?.parent; o !== undefined && o !== null; o = o.parent) if (o === owner) return true;
    return false;
  };
  const all = (): Node[] =>
    nodes().flatMap((n) => {
      const run = [n];
      for (let p = n.previousSibling; p !== null && below(p); p = p.previousSibling) run.unshift(p);
      return run;
    });
  const clear = (): void => {
    const gone = all();
    if (owner !== null) disposeOwner(owner);
    owner = null;
    for (const n of gone) n.parentNode?.removeChild(n);
    nodes = () => [];
  };
  const e = effect(
    () => {
      const hydrate = first ? claim : null;
      first = false;
      clear();
      if (parent.gone) return;
      const o = createOwner(parent, parent.root, catcher);
      owner = o;
      const box: { out: Node | null } = { out: null };
      const onError = (error: unknown): void => report(o, error, at);
      try {
        scope(
          () => {
            // Untracked: a read while the unit is built is its value at build; bindings, computeds and effects made
            // here track their own reads (k.component Build).
            const sc = running();
            box.out = sc === undefined ? withCx(o, hydrate, render) : sc.run(() => withCx(o, hydrate, render));
          },
          catcher === null ? {} : { onError },
        );
      } catch (error) {
        if (error instanceof Mismatch && hydrate !== null) {
          hydrate.session.failed ??= error;
          return;
        }
        report(o, error, at);
        return;
      }
      const out = box.out;
      if (out === null) return;
      const held = heldOf.get(out);
      const top = out.nodeType === 11 ? [...out.childNodes] : [out];
      nodes = held === undefined ? () => top : () => nodesOf(held.nodes ?? []);
      if (held === undefined) for (const n of top) unitOwners.set(n, o);
      if (hydrate === null) anchor.parentNode?.insertBefore(out, anchor);
      onRendered?.();
    },
    { writes: catcher === null ? [] : [catcher.state] },
  );
  return {
    nodes: all,
    dispose() {
      e.dispose();
      clear();
    },
  };
}
