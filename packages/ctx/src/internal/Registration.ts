import type { Schema } from "@keel/schema";
import type { Ctx } from "../Ctx.ts";

/** One registered capability: the implementations object it came from (identity), its accessor and its plan schema. */
export interface Registration {
  readonly impls: object;
  readonly accessor: (ctx: Ctx) => object;
  readonly plan: Schema<unknown, boolean> | undefined;
}
