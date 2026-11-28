import type { Ctx } from "../Ctx.ts";
import { supervisedBy } from "./supervisedBy.ts";

/**
 * Hear each throw `supervise` takes on `ctx` (k.supervise Report), for the server that serves with it; kernel code
 * only. Returns the removal, which leaves a later listener alone.
 */
export function onSupervised(ctx: Ctx, listener: (id: string, thrown: unknown) => void): () => void {
  supervisedBy.set(ctx, listener);
  return () => {
    if (supervisedBy.get(ctx) === listener) supervisedBy.delete(ctx);
  };
}
