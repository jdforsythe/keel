import type { Scope } from "../types/Scope.ts";
import type { Node } from "./Node.ts";
import { rt } from "./rt.ts";

/**
 * Make `sc` the owner of whatever is created from now until the returned `release` runs, across awaits: the `keel dev`
 * server module holds its load's root scope while the app's modules evaluate, so their module-level scopes and stores
 * belong to it and end when it is disposed. Code that sets the owner (a scope, a `run`) restores it as it returns, so
 * between those the owner is `sc` again. `release` puts back the owner found at the call; a second call does nothing.
 */
export function holdOwner(sc: Scope): () => void {
  let held: Node | null = null;
  sc.run(() => {
    held = rt.owner;
  });
  const before = rt.owner;
  rt.owner = held;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    rt.owner = before;
  };
}
