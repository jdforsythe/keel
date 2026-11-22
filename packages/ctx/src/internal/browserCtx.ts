import type { Ctx } from "../Ctx.ts";
import type { KeyValueStorage } from "../KeyValueStorage.ts";
import type { Net } from "../Net.ts";
import { ctxMeta } from "./ctxMeta.ts";
import { realStorage } from "./realStorage.ts";
import { simStorage } from "./simStorage.ts";

/**
 * A ctx for one browser beside `ctx` (k.mount Testing): `ctx`'s clock and random, `net` in place of its net, and
 * `storage`, else a fresh storage of `ctx`'s mode. It has `ctx`'s mode, seed and plans, so a registered capability
 * builds on it as on any ctx `createCtx` made, one instance of its own.
 */
export function browserCtx(ctx: Ctx, opts: { readonly net: Net; readonly storage?: KeyValueStorage }): Ctx {
  const meta = ctxMeta.get(ctx) ?? { mode: "sim", seed: 0, given: undefined, plans: {} };
  const storage = opts.storage ?? (meta.mode === "sim" ? simStorage() : realStorage());
  const made: Ctx = Object.freeze({ clock: ctx.clock, random: ctx.random, net: opts.net, storage });
  ctxMeta.set(made, meta);
  return made;
}
