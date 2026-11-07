import type { Ctx } from "../Ctx.ts";

/** One registered capability: the implementations object it came from (identity) and its accessor. */
export interface Registration {
  readonly impls: object;
  readonly accessor: (ctx: Ctx) => object;
}
