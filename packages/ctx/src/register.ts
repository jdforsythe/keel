import { narrowAccessor } from "../unsafe/narrowAccessor.ts";
import type { Capability } from "./Capability.ts";
import type { Ctx } from "./Ctx.ts";
import { ctxMeta } from "./internal/ctxMeta.ts";
import { deriveSeed } from "./internal/deriveSeed.ts";
import { extensions } from "./internal/extensions.ts";
import { kernelNames } from "./internal/kernelNames.ts";
import { noteRegistration } from "./internal/noteRegistration.ts";
import { planOf } from "./internal/planOf.ts";

/**
 * Register a capability (extension point). Returns the typed accessor `(ctx) => T`, the only way to reach it.
 * Resolution is lazy: the first access on a ctx builds the implementation for its mode, so ctx and register may be created in either order. Each factory receives a seed derived from the ctx seed and the name. Registering the same name with the
 * identical `impls` object again returns the original accessor (HMR safe); any other repeat throws E1602. With `plan`,
 * the sim factory also gets the schedule's `plans[name]`, each step parsed by `plan`; a step that fails throws E1604
 * at the capability's first access on that ctx. Under `keel dev` the stack it ran on is recorded (k.data Dev).
 */
export function register<T extends object, P = never>(name: string, impls: Capability<T, P>): (ctx: Ctx) => T {
  const existing = extensions.get(name);
  if (existing !== undefined && existing.impls === impls) return narrowAccessor<T>(existing.accessor);
  if (kernelNames.includes(name) || existing !== undefined) {
    throw Object.assign(new Error(`capability "${name}" is already registered`), { code: "E1602" });
  }
  const instances = new WeakMap<Ctx, T>();
  const accessor = (ctx: Ctx): T => {
    const cached = instances.get(ctx);
    if (cached !== undefined) return cached;
    const meta = ctxMeta.get(ctx);
    if (meta === undefined) throw new Error(`capability "${name}": not a ctx made by createCtx`);
    const seed = deriveSeed(meta.seed, name);
    const sim: { sim(opts: { readonly seed: number; readonly plan: readonly unknown[] }): T } = impls;
    const impl =
      meta.mode === "sim"
        ? sim.sim({ seed, plan: planOf(name, impls.plan, meta.plans[name]) })
        : impls[meta.mode]({ seed });
    instances.set(ctx, impl);
    return impl;
  };
  extensions.set(name, { impls, accessor, plan: impls.plan });
  noteRegistration(name);
  return accessor;
}
