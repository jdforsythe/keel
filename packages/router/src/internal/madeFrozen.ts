import { kernelSet } from "@keel/schema/internal";
import type { Made } from "./Made.ts";

/**
 * `v` recorded in the realm's kernel record as a value the router's maker of `kind` made (k.identity), and frozen.
 * No property of `v` carries the record: a spread, a clone or a `Proxy` of it is not in it.
 */
export function madeFrozen<T extends object>(v: T, kind: Made): Readonly<T> {
  kernelSet(`router.${kind}`).add(v);
  return Object.freeze(v);
}
