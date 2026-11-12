import type { Ctx } from "./Ctx.ts";
import type { CtxOptions } from "./CtxOptions.ts";
import type { Mode } from "./Mode.ts";
import type { SimCtx } from "./SimCtx.ts";
import { ctxMeta } from "./internal/ctxMeta.ts";
import { defaultMode } from "./internal/defaultMode.ts";
import { realClock } from "./internal/realClock.ts";
import { realNet } from "./internal/realNet.ts";
import { realRandom } from "./internal/realRandom.ts";
import { realStorage } from "./internal/realStorage.ts";
import { report } from "./internal/report.ts";
import { simClock } from "./internal/simClock.ts";
import { simNet } from "./internal/simNet.ts";
import { simRandom } from "./internal/simRandom.ts";
import { simStorage } from "./internal/simStorage.ts";

function seal<C extends Ctx>(ctx: C, mode: Mode, seed: number, given: number | undefined): C {
  ctxMeta.set(ctx, { mode, seed, given });
  return Object.freeze(ctx);
}

/**
 * Create a ctx. Registered capabilities build on first access, so `register` may come before or after. Every capability object is fresh per ctx. `shell` delegates to the real implementations
 * until native adapters exist. Mode defaults to sim under KEEL_TEST=1, else real. `storage` replaces the platform
 * `localStorage` in real and shell modes.
 */
export function createCtx(opts: CtxOptions & { readonly mode: "sim" }): SimCtx;
export function createCtx(opts: CtxOptions): Ctx;
export function createCtx(opts: CtxOptions): Ctx {
  const mode = opts.mode ?? defaultMode();
  const seed = opts.seed ?? 0;
  // The net reports connectivity changes on the ctx it belongs to; a window listener must not keep that ctx alive.
  const self: { ref?: WeakRef<Ctx> } = {};
  const changed = (online: boolean): void => report(self.ref?.deref(), { kind: "net", online });
  if (mode === "sim") {
    const sim: SimCtx = { clock: simClock(), random: simRandom(seed), net: simNet(changed), storage: simStorage() };
    self.ref = new WeakRef(sim);
    return seal(sim, mode, seed, opts.seed);
  }
  const net = realNet(changed);
  const ctx: Ctx = { clock: realClock(), random: realRandom(), net, storage: opts.storage ?? realStorage() };
  self.ref = new WeakRef(ctx);
  return seal(ctx, mode, seed, opts.seed);
}
