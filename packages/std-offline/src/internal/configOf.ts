import type { Config } from "./Config.ts";

const configs = new WeakMap<object, () => Config>();

/**
 * The declaration behind an outbox, built on first use; with `set`, records how to build it. Throws for a value
 * `outbox` did not return.
 */
export function configOf(o: object, set?: () => Config): Config {
  if (set !== undefined) configs.set(o, set);
  const c = configs.get(o);
  if (c === undefined) throw new Error("not an outbox");
  return c();
}
