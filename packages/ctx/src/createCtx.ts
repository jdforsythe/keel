import type { Ctx } from "./Ctx.ts";
import type { CtxOptions } from "./CtxOptions.ts";
import type { Mode } from "./Mode.ts";
import type { SimCtx } from "./SimCtx.ts";
import { defaultMode } from "./internal/defaultMode.ts";
import { extensions } from "./internal/extensions.ts";
import { realClock } from "./internal/realClock.ts";
import { realNet } from "./internal/realNet.ts";
import { realRandom } from "./internal/realRandom.ts";
import { realStorage } from "./internal/realStorage.ts";
import { simClock } from "./internal/simClock.ts";
import { simNet } from "./internal/simNet.ts";
import { simRandom } from "./internal/simRandom.ts";
import { simStorage } from "./internal/simStorage.ts";

function withExtensions<C extends Ctx>(ctx: C, mode: Mode, seed: number): C {
  for (const attach of extensions.values()) attach(ctx, mode, seed);
  return Object.freeze(ctx);
}

/**
 * Create a ctx. Every capability object is fresh per ctx. `shell` delegates to the real implementations
 * until native adapters exist (task 0009 D1). Mode defaults to sim under KEEL_TEST=1, else real.
 */
export function createCtx(opts: CtxOptions & { readonly mode: "sim" }): SimCtx;
export function createCtx(opts: CtxOptions): Ctx;
export function createCtx(opts: CtxOptions): Ctx {
  const mode = opts.mode ?? defaultMode();
  const seed = opts.seed ?? 0;
  if (mode === "sim") {
    const sim: SimCtx = { clock: simClock(), random: simRandom(seed), net: simNet(), storage: simStorage() };
    return withExtensions(sim, mode, seed);
  }
  const ctx: Ctx = { clock: realClock(), random: realRandom(), net: realNet(), storage: realStorage() };
  return withExtensions(ctx, mode, seed);
}
