import type { Made } from "./Made.ts";
import { records } from "./records.ts";

/**
 * `v` recorded in the router's record as a value the router's maker of `kind` made (k.identity), and frozen.
 * No property of `v` carries the record: a spread, a clone or a `Proxy` of it is not in it.
 */
export function madeFrozen<T extends object>(v: T, kind: Made): Readonly<T> {
  records[kind].add(v);
  return Object.freeze(v);
}
