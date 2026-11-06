import type { Rec } from "./Rec.ts";

/** A shallow own-enumerable copy of `v` when it is a non-array object, else `{}`. */
export function toRecord(v: unknown): Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
}
