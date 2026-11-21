import type { Config } from "./Config.ts";
import { configs } from "./configs.ts";

/** Record how outbox `o` builds its declaration; nothing is built until the outbox is first used. */
export function declareConfig(o: object, build: () => Config): void {
  configs.set(o, build);
}
