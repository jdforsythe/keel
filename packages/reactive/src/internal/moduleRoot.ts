import { scope } from "../scope.ts";
import { rt } from "./rt.ts";

/**
 * Run `fn` in a module root (k.reactive Module roots): a scope with no `parent` that lives as long as the module, the
 * owner of what one compiled top-level statement makes. The compiler wraps each such statement in a call; nothing else
 * makes one. The root is marked, so every node it owns is module state (k.shared): its `run`, the one running `fn`
 * included, and a `set` on a signal it owns ask `moduleWrites` first.
 */
export function moduleRoot<T>(fn: () => T): T {
  const root = scope(
    () => {
      if (rt.owner !== null) rt.owner.module = true;
    },
    { detached: true },
  );
  return root.run(fn);
}
