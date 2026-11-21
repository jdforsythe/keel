import type { KeelError, Result } from "@keel/schema";

/** What `caught` gives: `attempt`'s Result, and the thrown value's app frames (`appFrames`; `[]` when it resolved). */
export type CaughtRun<T> = {
  readonly result: Result<T, KeelError<"keel.unexpected", { readonly cause: string }>>;
  readonly frames: readonly string[];
};
