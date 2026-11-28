import type { Ctx } from "../Ctx.ts";
import { realmShared } from "./realmShared.ts";

/** A sim ctx and the replicas made from it, weakly held: the contexts a net connectivity change is reported to. */
export const replicaSets: WeakMap<Ctx, WeakRef<Ctx>[]> = realmShared("keel.ctxReplicas");
