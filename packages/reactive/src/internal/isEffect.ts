import type { Node } from "./Node.ts";

/** Effects and resources run at commit; they are queued, never refreshed by a read. */
export function isEffect(n: Node): boolean {
  return n.kind === "effect" || n.kind === "resource";
}
