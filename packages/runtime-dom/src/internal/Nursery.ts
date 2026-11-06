import type { Signal } from "@keel/reactive";

/** Spawns effects that outlive the effect that requested them (see createNursery). */
export interface Nursery {
  /** Declare in the `writes` of any effect that calls `spawn`. */
  readonly tick: Signal<unknown>;
  /** Run `fn` (which creates reactive primitives) under the nursery's stable owner, within the current commit. */
  spawn(fn: () => void): void;
}
