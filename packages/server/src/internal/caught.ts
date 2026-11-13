import { attempt, ok } from "@keel/schema";
import type { CaughtRun } from "./CaughtRun.ts";

/**
 * Run `fn` as `attempt` does (the same `keel.unexpected` KeelError on a throw or rejection) and keep what `frames` (the
 * app's `appFrames` reader) reads from what it threw, for the log `diag` (k.server Log). The stack never enters the
 * KeelError, which reaches results, the browser and session captures. Never rejects.
 */
export async function caught<T>(
  fn: () => T | PromiseLike<T>,
  frames: (thrown: unknown) => readonly string[],
): Promise<CaughtRun<T>> {
  try {
    return { result: ok(await fn()), frames: [] };
  } catch (thrown) {
    const rethrown = (): never => {
      throw thrown;
    };
    return { result: attempt(rethrown), frames: frames(thrown) };
  }
}
