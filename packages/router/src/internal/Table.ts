import type { Registered } from "./Registered.ts";

/** One manifest's routes by id, compiled. Each manifest owns its table; tables never merge. */
export type Table = ReadonlyMap<string, Registered>;
