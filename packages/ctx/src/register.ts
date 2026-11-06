import type { Capability } from "./Capability.ts";
import type { Ctx } from "./Ctx.ts";
import { extensions } from "./internal/extensions.ts";
import { kernelNames } from "./internal/kernelNames.ts";

/**
 * Register a capability (extension point). Every ctx created afterwards gets `ctx[name]`, built by the factory
 * for its mode. Returns the typed accessor for it. A name already taken (kernel or registered) throws E1602.
 */
export function register<T extends object>(name: string, impls: Capability<T>): (ctx: Ctx) => T {
  if (kernelNames.includes(name) || extensions.has(name)) {
    throw Object.assign(new Error(`capability "${name}" is already registered`), { code: "E1602" });
  }
  const instances = new WeakMap<Ctx, T>();
  extensions.set(name, (target, mode, seed) => {
    const impl = impls[mode]({ seed });
    instances.set(target, impl);
    Object.defineProperty(target, name, { value: impl, enumerable: true });
  });
  return (ctx) => {
    const impl = instances.get(ctx);
    if (impl === undefined) throw new Error(`capability "${name}" is absent: ctx was created before register`);
    return impl;
  };
}
