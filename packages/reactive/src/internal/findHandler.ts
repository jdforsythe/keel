import type { Node } from "./Node.ts";

/** The `onError` of the nearest scope above `n` that declared one. */
export function findHandler(n: Node): ((error: unknown) => void) | undefined {
  for (let o = n.owner; o; o = o.owner) if (o.onError) return o.onError;
  return undefined;
}
