import type { Node } from "./Node.ts";

/** Whether `n` is a module root (`moduleRoot`) or its owner chain ends at one (k.reactive Module roots). */
export function moduleOwned(n: Node): boolean {
  let at: Node | null = n;
  while (at !== null) {
    if (at.module === true) return true;
    at = at.owner;
  }
  return false;
}
