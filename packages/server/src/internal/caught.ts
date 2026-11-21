import { err, ok } from "@keel/schema";
import type { CaughtRun } from "./CaughtRun.ts";
import { unexpectedOf } from "./unexpectedOf.ts";

/**
 * Run `fn` as `attempt` does (the same `keel.unexpected` KeelError on a throw or rejection, read through
 * `unexpectedOf`) and keep what `frames` (the app's `appFrames` reader) reads from what it threw, for the log `diag`
 * (k.server Log); a reader that throws on the value gives no frames. The stack never enters the KeelError, which
 * reaches results, the browser and session captures. Never rejects, whatever was thrown.
 */
export async function caught<T>(
  fn: () => T | PromiseLike<T>,
  frames: (thrown: unknown) => readonly string[],
): Promise<CaughtRun<T>> {
  try {
    return { result: ok(await fn()), frames: [] };
  } catch (thrown) {
    let read: readonly string[] = [];
    try {
      read = frames(thrown);
    } catch {
      read = [];
    }
    return { result: err(unexpectedOf(thrown)), frames: read };
  }
}
