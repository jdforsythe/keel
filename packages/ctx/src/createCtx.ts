import type { Ctx } from "./Ctx.ts";
import type { CtxOptions } from "./CtxOptions.ts";
import type { Mode } from "./Mode.ts";
import { Schedule } from "./Schedule.schema.ts";
import type { SimCtx } from "./SimCtx.ts";
import { E1604 } from "./internal/E1604.ts";
import { E1605 } from "./internal/E1605.ts";
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

function seal<C extends Ctx>(ctx: C, mode: Mode, seed: number, given: number | undefined, plans: Schedule["plans"]): C {
  ctxMeta.set(ctx, { mode, seed, given, plans });
  return Object.freeze(ctx);
}

/**
 * Create a ctx. Registered capabilities build on first access, so `register` may come before or after. Every capability object is fresh per ctx. `shell` delegates to the real implementations
 * until native adapters exist. Mode defaults to sim under KEEL_TEST=1, else real. `drivers` replaces the platform
 * `storage` or `net` in real and shell modes and throws E1605 on sim (k.persist). `schedule` (sim only, else E1604; it must parse with `Schedule`, else E1604)
 * drives the sim net, storage and offline windows and holds the capability plans (k.sim).
 */
export function createCtx(opts: CtxOptions & { readonly mode: "sim" }): SimCtx;
export function createCtx(opts: CtxOptions): Ctx;
export function createCtx(opts: CtxOptions): Ctx {
  const mode = opts.mode ?? defaultMode();
  const seed = opts.seed ?? 0;
  // The net reports connectivity changes on the ctx it belongs to; a window listener must not keep that ctx alive.
  const self: { ref?: WeakRef<Ctx> } = {};
  const changed = (online: boolean): void => report(self.ref?.deref(), { kind: "net", online });
  if (opts.drivers !== undefined && mode === "sim") throw E1605();
  if (opts.schedule !== undefined && mode !== "sim") throw E1604(`schedule on a ${mode} ctx`);
  if (mode === "sim") {
    const parsed = Schedule.parse(opts.schedule ?? { net: [], storage: [], offline: [], plans: {} });
    if (!parsed.ok) throw E1604(`schedule: ${parsed.error.message}`);
    const { net: steps, storage, offline, plans } = parsed.value;
    const timers = offline.flatMap(({ at, ms }) => [
      { at, fn: () => net.setOnline(false) },
      { at: at + ms, fn: () => net.setOnline(true) },
    ]);
    const clock = simClock(timers);
    const net = simNet(changed, clock, steps);
    const sim: SimCtx = { clock, random: simRandom(seed), net, storage: simStorage(storage) };
    self.ref = new WeakRef(sim);
    // Windows that open at time 0 apply before the ctx is returned.
    clock.advance(0);
    return seal(sim, mode, seed, opts.seed, plans);
  }
  const { net = realNet(changed), storage = realStorage() } = opts.drivers ?? {};
  const ctx: Ctx = { clock: realClock(), random: realRandom(), net, storage };
  self.ref = new WeakRef(ctx);
  return seal(ctx, mode, seed, opts.seed, {});
}
