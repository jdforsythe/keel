import type { Config } from "./Config.ts";
import { configs } from "./configs.ts";

/** The declaration behind an outbox, built on first use. Throws for a value `outbox` did not return. */
export function configOf(o: object): Config {
  const c = configs.get(o);
  if (c === undefined) throw new Error("not an outbox");
  return c();
}
