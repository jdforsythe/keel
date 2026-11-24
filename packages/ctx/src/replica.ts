import type { SimCtx } from "./SimCtx.ts";
import { E1604 } from "./internal/E1604.ts";
import { ctxMeta } from "./internal/ctxMeta.ts";
import { replicaSets } from "./internal/replicaSets.ts";
import { simStorage } from "./internal/simStorage.ts";

/**
 * A sim ctx standing for another process on the same storage (k.sim Replicas): it shares `ctx`'s clock, random, net, schedule
 * and capability implementations; its `storage` is another object on the same data, and its observers are its own. A real or
 * shell ctx throws E1604.
 */
export function replica(ctx: SimCtx): SimCtx {
  const meta = ctxMeta.get(ctx);
  if (meta === undefined || meta.mode !== "sim") throw E1604(`replica of a ${meta?.mode ?? "foreign"} ctx`);
  const root = meta.root ?? ctx;
  const made: SimCtx = { clock: ctx.clock, random: ctx.random, net: ctx.net, storage: simStorage([], ctx.storage) };
  ctxMeta.set(made, { ...meta, root });
  const set = replicaSets.get(root) ?? [];
  set.push(new WeakRef(made));
  replicaSets.set(root, set);
  return Object.freeze(made);
}
