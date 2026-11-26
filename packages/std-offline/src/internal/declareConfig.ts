import type { Config } from "./Config.ts";
import { configs } from "./configs.ts";

/** Record how outbox `o` reads its declaration. */
export function declareConfig(o: object, build: () => Config): void {
  configs.set(o, build);
}
