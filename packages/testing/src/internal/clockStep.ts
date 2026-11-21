import type { Ctx } from "@keel/ctx";
import { simClocks } from "./simClocks.ts";

/**
 * How the harness `settle` moves time on `ctx` while a route waits with nothing else moving: a `simulate` run's ctx
 * steps to its next clock deadline; any other ctx never steps (its clock is the test's to advance).
 */
export function clockStep(ctx: Ctx): () => boolean {
  return () => simClocks.get(ctx)?.() ?? false;
}
