import type { Ctx } from "../Ctx.ts";
import type { Hub } from "./Hub.ts";
import { realmShared } from "./realmShared.ts";

/**
 * Observer state per ctx (k.ctx Observers); a ctx nothing observed or navigated has none. Shared by every copy of this
 * module in the realm, so a test harness's fresh module graph observes the ctx the test made.
 */
export const hubs: WeakMap<Ctx, Hub> = realmShared("keel.ctxHubs");
