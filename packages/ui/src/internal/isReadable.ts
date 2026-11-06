import type { Computed } from "@keel/reactive";

/** True for a signal or computed (anything with a `get()` method). */
export function isReadable(x: unknown): x is Computed<unknown> {
  return typeof x === "object" && x !== null && "get" in x && typeof x.get === "function";
}
