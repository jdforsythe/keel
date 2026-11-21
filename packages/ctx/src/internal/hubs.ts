import type { Ctx } from "../Ctx.ts";
import type { Hub } from "./Hub.ts";

/** Observer state per ctx (k.ctx Observers); a ctx nothing observed or navigated has none. */
export const hubs: WeakMap<Ctx, Hub> = new WeakMap();
