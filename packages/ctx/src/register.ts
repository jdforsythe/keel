import { narrowAccessor } from "../unsafe/narrowAccessor.ts";
import type { Capability } from "./Capability.ts";
import type { Ctx } from "./Ctx.ts";
import { deriveSeed } from "./internal/deriveSeed.ts";
import { extensions } from "./internal/extensions.ts";
import { kernelNames } from "./internal/kernelNames.ts";

/**
 * Register a capability (extension point). Returns the typed accessor `(ctx) => T`, the only way to reach it.
 * Each factory receives a seed derived from the ctx seed and the name. Registering the same name with the
 * identical `impls` object again returns the original accessor (HMR safe); any other repeat throws E1602.
 */
export function register<T extends object>(name: string, impls: Capability<T>): (ctx: Ctx) => T {
  const existing = extensions.get(name);
  if (existing !== undefined && existing.impls === impls) return narrowAccessor<T>(existing.accessor);
  if (kernelNames.includes(name) || existing !== undefined) {
    throw Object.assign(new Error(`capability "${name}" is already registered`), { code: "E1602" });
  }
  const instances = new WeakMap<Ctx, T>();
  const accessor = (ctx: Ctx): T => {
    const impl = instances.get(ctx);
    if (impl === undefined) throw new Error(`capability "${name}" is absent: ctx was created before register`);
    return impl;
  };
  extensions.set(name, {
    impls,
    accessor,
    attach: (target, mode, seed) => {
      instances.set(target, impls[mode]({ seed: deriveSeed(seed, name) }));
    },
  });
  return accessor;
}
