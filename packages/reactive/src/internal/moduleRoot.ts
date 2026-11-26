import { scope } from "../scope.ts";

/**
 * Run `fn` in a module root (k.reactive Module roots): a scope with no `parent` that lives as long as the module, the
 * owner of what one compiled top-level statement makes. The compiler wraps each such statement in a call; nothing else
 * makes one.
 */
export function moduleRoot<T>(fn: () => T): T {
  return scope(() => undefined, { detached: true }).run(fn);
}
