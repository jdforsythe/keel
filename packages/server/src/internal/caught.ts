import { attempt, ok } from "@keel/schema";
import type { CaughtRun } from "./CaughtRun.ts";
import { appFrames } from "./appFrames.ts";

/**
 * Run `fn` as `attempt` does (the same `keel.unexpected` KeelError on a throw or rejection) and keep the first 5 app
 * stack positions of what it threw for the log `diag` (k.server Log). The stack never enters the KeelError, which
 * reaches results, the browser and session captures. Never rejects.
 */
export async function caught<T>(fn: () => T | PromiseLike<T>): Promise<CaughtRun<T>> {
  try {
    return { result: ok(await fn()), frames: [] };
  } catch (thrown) {
    const rethrown = (): never => {
      throw thrown;
    };
    return { result: attempt(rethrown), frames: appFrames(thrown, process.cwd()) };
  }
}
