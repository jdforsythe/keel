import type { Ctx } from "../Ctx.ts";
import type { Attach } from "./Attach.ts";

/** One registered capability: the implementations object it came from (identity), its accessor, and its per-ctx builder. */
export interface Registration {
  readonly impls: object;
  readonly accessor: (ctx: Ctx) => object;
  readonly attach: Attach;
}
