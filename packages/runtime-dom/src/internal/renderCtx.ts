import type { Ctx } from "@keel/ctx";
import { cx } from "./cx.ts";

/** The ctx of the mount, resume or island rendering now, or undefined outside a render or for a root given none. */
export function renderCtx(): Ctx | undefined {
  return cx.owner?.root.ctx;
}
