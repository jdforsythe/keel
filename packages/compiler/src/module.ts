import { ModuleSchema } from "./ModuleSchema.ts";
import type { ModuleDef } from "./types/ModuleDef.ts";

const fail = (message: string): Error => Object.assign(new Error(message), { code: "keel.module" });

/**
 * Declare a module manifest (k.module), the default export of `modules/<id>/module.ts`. Validates it with
 * `ModuleSchema` (which includes the lowerCamel `id` rule) and returns it unchanged (frozen), literal types kept,
 * for the compiler and `keel check` to read. Throws an Error with `code: 'keel.module'` on an invalid manifest.
 * Cross-module checks (E1151-E1157) are `keel check`'s, not this function's.
 */
export function module<const M extends ModuleDef>(def: M): M {
  const parsed = ModuleSchema.parse(def);
  if (!parsed.ok) throw fail(`module manifest: ${parsed.error.message.slice(0, 70)}`);
  return Object.freeze(def);
}
