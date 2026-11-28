import type { Computed } from "@keel/reactive";
import { isReadable } from "../src/internal/isReadable.ts";
import { unsafe } from "./unsafe.ts";

/** A host's `value` read now: a signal's or computed's current value, a plain value as it is. */
export function readValue<I>(v: I | Computed<I>): I {
  if (!isReadable(v)) return v;
  return unsafe(
    "HostProps types value as I or Computed<I>, and a readable value is the Computed<I> arm, so what its get() returns is an I",
    () => v.get() as I,
  );
}
