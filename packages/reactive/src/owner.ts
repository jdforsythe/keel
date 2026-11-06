import { rt } from "./internal/rt.ts";
import type { Scope } from "./types/Scope.ts";

/** The scope owning the running code (nearest enclosing scope, also inside computeds and effects), or undefined. */
export function owner(): Scope | undefined {
  for (let n = rt.owner; n; n = n.owner) if (n.handle) return n.handle;
  return undefined;
}
