import type { Catcher } from "./Catcher.ts";
import type { Owner } from "./Owner.ts";
import type { Root } from "./Root.ts";

/** A child owner of `parent` (or a root owner); born gone when its parent already is. */
export function createOwner(parent: Owner | null, root: Root, catcher: Catcher | null): Owner {
  const o: Owner = { parent, root, catcher, children: new Set(), cleanups: [], gone: parent?.gone ?? false };
  if (parent !== null && !parent.gone) parent.children.add(o);
  return o;
}
