import type { KeelError, Result } from "@keel/schema";

/**
 * What `caught` gives: `attempt`'s Result, the thrown value's app frames (`appFrames`; `[]` when it resolved), and the
 * thrown value itself, for its log records only (`ThrownRecords`; `undefined` when it resolved).
 */
export type CaughtRun<T> = {
  readonly result: Result<T, KeelError<"keel.unexpected", { readonly cause: string }>>;
  readonly frames: readonly string[];
  readonly thrown: unknown;
};
