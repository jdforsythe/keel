import type { Ctx } from "@keel/ctx";
import { defect } from "@keel/schema";
import { refreshView } from "./refreshView.ts";

/**
 * Re-reads the board after a write a button sent (Undo, Remove, Undo of a removal). A click has no caller to hand a
 * failed read to, so it raises, and the boundary around the page shows it as it shows a loader's failed read.
 */
export async function reread(ctx: Ctx): Promise<void> {
  const r = await refreshView(ctx);
  if (!r.ok) defect("the board could not be read again", { data: { code: r.error.code }, cause: r.error });
}
