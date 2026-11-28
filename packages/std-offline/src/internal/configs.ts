import type { Config } from "./Config.ts";

/** How each outbox builds its declaration (`declareConfig`, `configOf`). */
export const configs = new WeakMap<object, () => Config>();
