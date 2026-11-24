import { unsafe } from "./unsafe.ts";

interface Task {
  readonly type?: string;
  readonly timeout?: number;
  readonly result?: { readonly startTime?: number };
}
interface Worker {
  readonly current?: Task;
}

/**
 * The timeout in ms of the vitest test running now and the epoch time in ms the runner started it at (before its
 * hooks), or `undefined` outside a test (a hook, or no vitest) and for a test with no timeout.
 */
export function currentTestBound(): { readonly timeout: number; readonly startedAt: number } | undefined {
  return unsafe("the running vitest task is on its untyped worker global; timeout and startTime are its own", () => {
    const worker = Reflect.get(globalThis, "__vitest_worker__") as Worker | undefined;
    const task = worker?.current;
    const timeout = task?.timeout;
    const startedAt = task?.result?.startTime;
    if (task?.type !== "test" || timeout === undefined || startedAt === undefined) return undefined;
    return Number.isFinite(timeout) && timeout > 0 ? { timeout, startedAt } : undefined;
  });
}
