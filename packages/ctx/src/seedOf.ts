import type { Ctx } from "./Ctx.ts";
import { ctxMeta } from "./internal/ctxMeta.ts";

/**
 * The seed given to `createCtx` for `ctx` (k.ctx Observers, rfc:0070), `undefined` when none was given or the ctx was
 * not made by `createCtx` (red-team 0213): a browser's unseeded ctx must not record a seed a replay cannot reproduce.
 */
export function seedOf(ctx: Ctx): number | undefined {
  return ctxMeta.get(ctx)?.given;
}
