import type { Config } from "./Config.ts";

const configs = new WeakMap<object, Config>();

/** The declaration behind an outbox store; with `set`, records it. Throws for a store `outbox` did not create. */
export function configOf(o: object, set?: Config): Config {
  if (set !== undefined) configs.set(o, set);
  const c = configs.get(o);
  if (c === undefined) throw new Error("not an outbox");
  return c;
}
