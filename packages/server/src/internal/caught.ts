import { type KeelError, type Result, attempt, ok } from "@keel/schema";
import { appFrames } from "./appFrames.ts";

/** What `caught` gives: `attempt`'s Result, and the thrown value's app frames (`appFrames`; `[]` when it resolved). */
export type Caught<T> = {
  readonly result: Result<T, KeelError<"keel.unexpected", { readonly cause: string }>>;
  readonly frames: readonly string[];
};

/**
 * Run `fn` as `attempt` does (the same `keel.unexpected` KeelError on a throw or rejection) and keep the first 5 app
 * stack positions of what it threw for the log `diag` (k.server Log). The stack never enters the KeelError, which
 * reaches results, the browser and session captures. Never rejects.
 */
export async function caught<T>(fn: () => T | PromiseLike<T>): Promise<Caught<T>> {
  try {
    return { result: ok(await fn()), frames: [] };
  } catch (thrown) {
    const rethrown = (): never => {
      throw thrown;
    };
    return { result: attempt(rethrown), frames: appFrames(thrown, process.cwd()) };
  }
}
