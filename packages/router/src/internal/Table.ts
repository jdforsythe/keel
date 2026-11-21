import type { Registered } from "./Registered.ts";

/** A route table's routes by id, compiled. */
export type Table = ReadonlyMap<string, Registered>;
